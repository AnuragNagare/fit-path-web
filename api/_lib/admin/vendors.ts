import { deleteBlobs } from '../blob.js';
import { rows, transaction } from '../db.js';
import { bodyObject, queryParam, type ApiRequest, type ApiResponse } from '../http.js';
import { hashToken, inviteExpiry, inviteStatus, newToken } from '../invites.js';
import { changedFields, deriveState, normalizeProfile } from '../vendor-model.js';
import { buildView, findGymById, loadMedia, reviewSummary } from '../vendor-store.js';
import { isUuid, isVendorGymId, text } from '../validate.js';

type InviteRow = {
  id: string;
  label: string;
  created_at: string | Date;
  expires_at: string | Date;
  used_at: string | Date | null;
  revoked_at: string | Date | null;
  gym_id: string | null;
  owner_name: string | null;
};

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

// GET    admin?resource=invites            ->  { invites }
// POST   admin?resource=invites {label}    ->  { token, invite }  the token is shown once; only its hash is kept
// DELETE admin?resource=invites&id=<uuid>  ->  { ok }  cancels a link that has not been used
export async function adminInvites(req: ApiRequest, res: ApiResponse, adminId: string) {
  if (req.method === 'GET') {
    const list = await rows<InviteRow>(
      `SELECT i.id, i.label, i.created_at, i.expires_at, i.used_at, i.revoked_at, g.id AS gym_id, g.owner_name
       FROM vendor_invites i LEFT JOIN vendor_gyms g ON g.invite_id = i.id ORDER BY i.created_at DESC LIMIT 200`,
    );
    return res.status(200).json({
      invites: list.map(i => ({
        id: i.id, label: i.label, status: inviteStatus(i), createdAt: iso(i.created_at), expiresAt: iso(i.expires_at),
        usedAt: iso(i.used_at), gymId: i.gym_id, ownerName: i.owner_name,
      })),
    });
  }

  if (req.method === 'POST') {
    const label = text(bodyObject(req).label, 80);
    if (!label.ok || !label.value) return res.status(400).json({ error: 'Add a label so you can tell the links apart, for example "FitZone, Pune".' });
    const token = newToken();
    const expires = inviteExpiry();
    const [invite] = await rows<{ id: string }>(
      'INSERT INTO vendor_invites (token_hash, label, created_by, expires_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [hashToken(token), label.value, adminId, expires.toISOString()],
    );
    return res.status(201).json({ token, invite: { id: invite.id, label: label.value, status: 'valid', expiresAt: expires.toISOString() } });
  }

  if (req.method === 'DELETE') {
    const id = queryParam(req, 'id');
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid link.' });
    const done = await rows('UPDATE vendor_invites SET revoked_at = now() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL RETURNING id', [id]);
    if (done.length === 0) return res.status(409).json({ error: 'Only links that have not been used can be cancelled.' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  res.status(405).json({ error: 'Method not allowed.' });
}

type QueueRow = {
  id: string;
  owner_name: string;
  owner_email: string;
  status: 'new' | 'pending' | 'live' | 'suspended';
  draft: unknown;
  live: unknown;
  draft_submitted_at: string | Date | null;
  review_note: string | null;
  approved_at: string | Date | null;
  updated_at: string | Date;
};

// GET   admin?resource=registrations[&filter=pending|all]  ->  { gyms }
// GET   admin?resource=registrations&id=vendor-...         ->  { gym, owner, changes, bookings }
// PATCH admin?resource=registrations {id, action: approve | reject | suspend | reinstate, note?}
export async function adminRegistrations(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    const id = queryParam(req, 'id');
    if (id === undefined) {
      const onlyPending = queryParam(req, 'filter') !== 'all';
      const list = await rows<QueueRow>(
        `SELECT id, owner_name, owner_email, status, draft, live, draft_submitted_at, review_note, approved_at, updated_at
         FROM vendor_gyms ${onlyPending ? 'WHERE draft_submitted_at IS NOT NULL' : ''}
         ORDER BY draft_submitted_at ASC NULLS LAST, updated_at DESC LIMIT 200`,
      );
      return res.status(200).json({
        gyms: list.map(g => ({
          id: g.id,
          name: normalizeProfile(g.draft).name ?? normalizeProfile(g.live).name,
          ownerName: g.owner_name,
          ownerEmail: g.owner_email,
          state: deriveState(g),
          firstSubmission: g.approved_at === null,
          submittedAt: iso(g.draft_submitted_at),
          updatedAt: iso(g.updated_at),
        })),
      });
    }
    if (!isVendorGymId(id)) return res.status(400).json({ error: 'Invalid gym.' });
    const gym = await findGymById(id);
    if (!gym) return res.status(404).json({ error: 'Gym not found.' });
    const [media, stats, bookingCount] = await Promise.all([
      loadMedia(id),
      reviewSummary(id),
      rows<{ n: number }>('SELECT count(*)::int AS n FROM bookings WHERE gym_id = $1', [id]),
    ]);
    const view = buildView(gym, media, stats);
    return res.status(200).json({
      gym: view,
      owner: { name: gym.owner_name, email: gym.owner_email },
      changes: changedFields(view.live, view.draft),
      bookings: bookingCount[0]?.n ?? 0,
    });
  }

  if (req.method === 'PATCH') {
    const body = bodyObject(req);
    if (!isVendorGymId(body.id)) return res.status(400).json({ error: 'Invalid gym.' });
    const gym = await findGymById(body.id);
    if (!gym) return res.status(404).json({ error: 'Gym not found.' });

    switch (body.action) {
      case 'approve': {
        if (!gym.draft_submitted_at) return res.status(409).json({ error: 'Nothing is waiting for approval.' });
        const media = await loadMedia(gym.id);
        const removed = media.filter(m => m.status === 'pending_remove').map(m => m.url);
        // The draft becomes the live profile and the media changes apply together.
        await transaction([
          [`UPDATE vendor_gyms SET live = draft, live_lat = (draft->>'lat')::double precision, live_lon = (draft->>'lon')::double precision,
              draft_submitted_at = NULL, review_note = NULL, approved_at = now(),
              status = CASE WHEN status = 'suspended' THEN 'suspended' ELSE 'live' END, updated_at = now()
            WHERE id = $1`, [gym.id]],
          ["UPDATE vendor_media SET status = 'approved' WHERE gym_id = $1 AND status = 'pending_add'", [gym.id]],
          ["DELETE FROM vendor_media WHERE gym_id = $1 AND status = 'pending_remove'", [gym.id]],
        ]);
        await deleteBlobs(removed);
        break;
      }
      case 'reject': {
        const note = text(body.note, 500);
        if (!note.ok || !note.value) return res.status(400).json({ error: 'Write a short note so the owner knows what to fix.' });
        if (!gym.draft_submitted_at) return res.status(409).json({ error: 'Nothing is waiting for approval.' });
        // Nothing changes publicly. The owner keeps their draft and uploads, fixes what the note says and submits again.
        await rows(
          `UPDATE vendor_gyms SET draft_submitted_at = NULL, review_note = $2,
             status = CASE WHEN status = 'pending' THEN 'new' ELSE status END, updated_at = now() WHERE id = $1`,
          [gym.id, note.value],
        );
        break;
      }
      case 'suspend':
        if (gym.status !== 'live') return res.status(409).json({ error: 'Only live gyms can be suspended.' });
        await rows("UPDATE vendor_gyms SET status = 'suspended', updated_at = now() WHERE id = $1", [gym.id]);
        break;
      case 'reinstate':
        if (gym.status !== 'suspended') return res.status(409).json({ error: 'This gym is not suspended.' });
        await rows("UPDATE vendor_gyms SET status = 'live', updated_at = now() WHERE id = $1", [gym.id]);
        break;
      default:
        return res.status(400).json({ error: 'Unknown action.' });
    }
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  res.status(405).json({ error: 'Method not allowed.' });
}
