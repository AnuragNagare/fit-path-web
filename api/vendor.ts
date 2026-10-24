import { randomUUID } from 'node:crypto';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { authUser, getClerkProfile, userIdFromToken } from './_lib/auth.js';
import { blobInfo, deleteBlobs } from './_lib/blob.js';
import { rows } from './_lib/db.js';
import { bodyObject, queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { hashToken, inviteStatus, isToken, type InviteStatus } from './_lib/invites.js';
import {
  isMediaKind, maxBytesFor, maxCountFor, parseMediaInput, parseVendorProfile, typesFor, uploadPathOk,
} from './_lib/vendor-model.js';
import {
  draftPhotoCount, findGymByOwner, loadMedia, loadView, VENDOR_COLUMNS, type VendorGymRow,
} from './_lib/vendor-store.js';
import { isUuid } from './_lib/validate.js';
import { changedFields, normalizeProfile, submitProblems } from './_lib/vendor-model.js';

const INVITE_MESSAGES: Record<Exclude<InviteStatus, 'valid'>, string> = {
  used: 'This link has already been used.',
  expired: 'This link has expired. Ask FitPath for a new one.',
  cancelled: 'This link was cancelled. Ask FitPath for a new one.',
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Member';

// A change by the owner takes the draft out of the admin's queue until they submit it again.
const WITHDRAW = "draft_submitted_at = NULL, status = CASE WHEN status = 'pending' THEN 'new' ELSE status END, updated_at = now()";

// Gym owners. One function, chosen with ?resource=:
//   invite (public)  claim  me  draft  submit  media  upload  bookings  reviews
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const resource = queryParam(req, 'resource');
  try {
    // These two do their own checks: `invite` is how a visitor learns whether a link works, and `upload`
    // is called by the Blob library, which carries the sign-in token inside its payload.
    if (resource === 'invite') return await invite(req, res);
    if (resource === 'upload') return await upload(req, res);

    const userId = await authUser(req, res);
    if (!userId) return;

    if (resource === 'claim') return await claim(req, res, userId);
    const gym = await findGymByOwner(userId);
    if (resource === 'me') return res.status(200).json({ gym: gym ? await loadView(gym) : null });
    if (!gym) return res.status(403).json({ error: "You don't have a gym profile yet. Open the registration link you were sent." });

    switch (resource) {
      case 'draft': return await saveDraft(req, res, gym);
      case 'submit': return await submit(req, res, gym);
      case 'media': return await media(req, res, gym);
      // Read-only for owners: bookings, reviews and ratings can only be changed by the admin.
      case 'bookings':
      case 'reviews':
        if (req.method !== 'GET') return res.status(405).json({ error: 'You can view this, but not change it.' });
        return resource === 'bookings' ? await bookings(res, gym) : await reviews(res, gym);
      default: return res.status(404).json({ error: 'Unknown resource.' });
    }
  } catch (err) {
    console.error('vendor', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Something went wrong. Please try again.' });
  }
}

// GET vendor?resource=invite&token=...  ->  { status, label }
async function invite(req: ApiRequest, res: ApiResponse) {
  const token = queryParam(req, 'token');
  if (!isToken(token)) return res.status(200).json({ status: 'unknown' });
  const [row] = await rows<{ label: string; used_at: string | null; revoked_at: string | null; expires_at: string }>(
    'SELECT label, used_at, revoked_at, expires_at FROM vendor_invites WHERE token_hash = $1',
    [hashToken(token)],
  );
  if (!row) return res.status(200).json({ status: 'unknown' });
  res.status(200).json({ status: inviteStatus(row), label: row.label });
}

// POST vendor?resource=claim {token, tier}  ->  { gym }  attaches a new gym to the caller and uses up the link
async function claim(req: ApiRequest, res: ApiResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const body = bodyObject(req);
  const token = body.token;
  const tier = body.tier === 'paid' ? 'paid' : 'free';
  if (!isToken(token)) return res.status(400).json({ error: 'This link is not valid.' });
  if (await findGymByOwner(userId)) return res.status(409).json({ error: 'This account already has a gym profile.' });

  const profile = await getClerkProfile(userId);
  const hash = hashToken(token);
  try {
    // One statement: the link is marked used only if the gym is created, and only once.
    const created = await rows(
      `WITH claimed AS (
         UPDATE vendor_invites SET used_at = now(), used_by_clerk_id = $2
         WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
         RETURNING id)
       INSERT INTO vendor_gyms (id, owner_clerk_id, owner_name, owner_email, invite_id, tier, tier_requested_at)
       SELECT $3, $2, $4, $5, id, $6, CASE WHEN $6 = 'paid' THEN now() ELSE NULL END FROM claimed RETURNING id`,
      [hash, userId, `vendor-${randomUUID()}`, profile.name, profile.email, tier],
    );
    if (created.length === 0) {
      const [row] = await rows<{ used_at: string | null; revoked_at: string | null; expires_at: string }>(
        'SELECT used_at, revoked_at, expires_at FROM vendor_invites WHERE token_hash = $1',
        [hash],
      );
      const status = row ? inviteStatus(row) : null;
      return res.status(status && status !== 'valid' ? 410 : 404).json({ error: status && status !== 'valid' ? INVITE_MESSAGES[status] : 'This link is not valid.' });
    }
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'This account already has a gym profile.' });
    throw err;
  }
  const gym = await findGymByOwner(userId);
  res.status(201).json({ gym: gym ? await loadView(gym) : null });
}

// PUT vendor?resource=draft {name, address, lat, lon, phone, website, hours, description, features, prices}
async function saveDraft(req: ApiRequest, res: ApiResponse, gym: VendorGymRow) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed.' });
  const input = parseVendorProfile(bodyObject(req));
  if (!input.ok) return res.status(400).json({ error: input.error });
  const [updated] = await rows<VendorGymRow>(
    `UPDATE vendor_gyms SET draft = $2::jsonb, ${WITHDRAW} WHERE id = $1 RETURNING ${VENDOR_COLUMNS}`,
    [gym.id, JSON.stringify(input.value)],
  );
  res.status(200).json({ gym: await loadView(updated) });
}

// POST vendor?resource=submit  ->  { gym }  sends the draft (and its media) to the admin
async function submit(req: ApiRequest, res: ApiResponse, gym: VendorGymRow) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (gym.draft_submitted_at) return res.status(200).json({ gym: await loadView(gym) });

  const media = await loadMedia(gym.id);
  const draft = normalizeProfile(gym.draft);
  const problems = submitProblems(draft, draftPhotoCount(media));
  if (problems.length > 0) return res.status(400).json({ error: problems.join(' ') });
  if (gym.status !== 'new' && changedFields(gym.live ? normalizeProfile(gym.live) : null, draft).length === 0 && media.every(m => m.status === 'approved')) {
    return res.status(409).json({ error: 'There are no changes to submit.' });
  }
  const [updated] = await rows<VendorGymRow>(
    `UPDATE vendor_gyms SET draft_submitted_at = now(), review_note = NULL,
       status = CASE WHEN status = 'new' THEN 'pending' ELSE status END, updated_at = now()
     WHERE id = $1 RETURNING ${VENDOR_COLUMNS}`,
    [gym.id],
  );
  res.status(200).json({ gym: await loadView(updated) });
}

// POST   vendor?resource=media {kind, url, alt}  ->  { gym }  adds an uploaded file to the draft
// DELETE vendor?resource=media&id=<uuid>         ->  { gym }  removes a new file now, or marks a live one for removal
async function media(req: ApiRequest, res: ApiResponse, gym: VendorGymRow) {
  if (req.method === 'POST') {
    const input = parseMediaInput(bodyObject(req));
    if (!input.ok) return res.status(400).json({ error: input.error });
    const { kind, url, alt } = input.value;
    // The file has to be one this owner uploaded to their own folder.
    if (!new URL(url).pathname.startsWith(`/vendor/${gym.id}/`)) return res.status(400).json({ error: 'Invalid file address.' });

    const info = await blobInfo(url);
    if (!info) return res.status(400).json({ error: "We couldn't find that file. Please upload it again." });
    if (!typesFor(kind).includes(info.contentType)) return res.status(400).json({ error: kind === 'photo' ? 'Photos must be JPEG, PNG or WebP.' : 'Videos must be MP4, WebM or MOV.' });
    if (info.size > maxBytesFor(kind)) return res.status(400).json({ error: `That ${kind} is too large (${maxBytesFor(kind) / 1024 / 1024} MB max).` });

    const current = await loadMedia(gym.id);
    if (current.some(m => m.url === url)) return res.status(409).json({ error: 'That file is already added.' });
    if (current.filter(m => m.kind === kind && m.status !== 'pending_remove').length >= maxCountFor(kind)) {
      return res.status(409).json({ error: `You can add up to ${maxCountFor(kind)} ${kind}s.` });
    }
    await rows(
      `INSERT INTO vendor_media (gym_id, kind, url, content_type, size_bytes, alt, position)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT coalesce(max(position) + 1, 0) FROM vendor_media WHERE gym_id = $1))`,
      [gym.id, kind, url, info.contentType, info.size, alt],
    );
  } else if (req.method === 'DELETE') {
    const id = queryParam(req, 'id');
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid file.' });
    const [item] = await rows<{ url: string; status: string }>('SELECT url, status FROM vendor_media WHERE id = $1 AND gym_id = $2', [id, gym.id]);
    if (!item) return res.status(404).json({ error: 'File not found.' });
    if (item.status === 'pending_add') {
      await rows('DELETE FROM vendor_media WHERE id = $1', [id]);
      await deleteBlobs([item.url]);
    } else {
      // A live file stays on the public page until the admin approves the removal; asking twice undoes it.
      await rows("UPDATE vendor_media SET status = CASE WHEN status = 'approved' THEN 'pending_remove' ELSE 'approved' END WHERE id = $1", [id]);
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const [updated] = await rows<VendorGymRow>(`UPDATE vendor_gyms SET ${WITHDRAW} WHERE id = $1 RETURNING ${VENDOR_COLUMNS}`, [gym.id]);
  res.status(200).json({ gym: await loadView(updated) });
}

// POST vendor?resource=upload  (called by @vercel/blob/client) -> issues a short-lived upload token
async function upload(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Photo and video uploads are not set up yet. Please try again later.' });
  }
  try {
    const result = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req as never,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? '{}') as { token?: unknown; kind?: unknown };
        const userId = typeof payload.token === 'string' ? await userIdFromToken(payload.token) : null;
        if (!userId) throw new Error('Sign in required.');
        const gym = await findGymByOwner(userId);
        if (!gym) throw new Error("You don't have a gym profile yet.");
        if (!isMediaKind(payload.kind)) throw new Error('Choose photo or video.');
        if (!uploadPathOk(pathname, gym.id)) throw new Error('Invalid file path.');
        return { allowedContentTypes: typesFor(payload.kind), maximumSizeInBytes: maxBytesFor(payload.kind), addRandomSuffix: true };
      },
      // The browser registers the file itself (resource=media), which also works on a local computer.
      onUploadCompleted: async () => {},
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload not allowed.' });
  }
}

// GET vendor?resource=bookings  ->  { bookings }  the gym's bookings, read-only, without customer emails
async function bookings(res: ApiResponse, gym: VendorGymRow) {
  const list = await rows<{ id: string; user_name: string; plan: string; start_date: string; end_date: string; people: number; amount_inr: number; status: string; payment_status: string; created_at: string | Date }>(
    `SELECT id, user_name, plan, start_date::text AS start_date, end_date::text AS end_date, people, amount_inr, status, payment_status, created_at
     FROM bookings WHERE gym_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [gym.id],
  );
  res.status(200).json({
    bookings: list.map(b => ({
      id: b.id, userName: b.user_name, plan: b.plan, startDate: b.start_date, endDate: b.end_date, people: b.people,
      amountInr: b.amount_inr, status: b.status, paymentStatus: b.payment_status, createdAt: new Date(b.created_at).toISOString(),
    })),
  });
}

// GET vendor?resource=reviews  ->  { reviews, summary }  the gym's visible reviews, read-only
async function reviews(res: ApiResponse, gym: VendorGymRow) {
  const list = await rows<{ id: string; user_name: string; rating: number; body: string | null; created_at: string | Date }>(
    'SELECT id, user_name, rating, body, created_at FROM reviews WHERE gym_id = $1 AND NOT hidden ORDER BY created_at DESC LIMIT 200',
    [gym.id],
  );
  const total = list.reduce((sum, r) => sum + r.rating, 0);
  res.status(200).json({
    reviews: list.map(r => ({ id: r.id, userName: firstName(r.user_name), rating: r.rating, body: r.body, createdAt: new Date(r.created_at).toISOString() })),
    summary: { rating: list.length ? Math.round((total / list.length) * 10) / 10 : null, reviewCount: list.length },
  });
}
