import { rows } from '../db.js';
import { getGymById } from '../geo.js';
import type { GymOverrideRow } from '../gym-data.js';
import { bodyObject, queryParam, type ApiRequest, type ApiResponse } from '../http.js';
import { isOsmGymId, MAX_IMAGES_PER_GYM, parseImageInput, parseOverrideInput } from '../validate.js';
import { isUuid } from '../validate.js';

// GET    admin?resource=gyms            ->  { gyms }  gyms the admin has edited or added photos to
// GET    admin?resource=gyms&id=node-1  ->  { osm, override, images }  the map's data next to the admin's edits
// PUT    admin?resource=gyms&id=node-1 {...}  ->  { override }  save edits (empty fields fall back to the map's data)
// DELETE admin?resource=gyms&id=node-1  ->  { ok }  reset to the map's data and unhide (photos are kept)
export async function adminGyms(req: ApiRequest, res: ApiResponse, adminId: string) {
  const id = queryParam(req, 'id');

  if (req.method === 'GET' && !id) {
    const list = await rows(
      `SELECT o.gym_id AS id, o.name, o.hidden, o.updated_at,
              (SELECT count(*)::int FROM gym_images i WHERE i.gym_id = o.gym_id) AS images,
              (SELECT count(*)::int FROM bookings b WHERE b.gym_id = o.gym_id) AS bookings
       FROM gym_overrides o ORDER BY o.updated_at DESC LIMIT 200`,
    );
    return res.status(200).json({ gyms: list });
  }

  if (!isOsmGymId(id)) return res.status(400).json({ error: 'Only map gyms are edited here. Registered gyms are edited by their owners.' });

  if (req.method === 'GET') {
    const [osm, [override], images] = await Promise.all([
      getGymById(id),
      rows<GymOverrideRow>('SELECT * FROM gym_overrides WHERE gym_id = $1', [id]),
      rows('SELECT id, alt, position FROM gym_images WHERE gym_id = $1 ORDER BY position, created_at', [id]),
    ]);
    if (!osm) return res.status(404).json({ error: 'Gym not found on the map.' });
    return res.status(200).json({ osm, override: override ?? null, images });
  }

  if (req.method === 'PUT') {
    const input = parseOverrideInput(bodyObject(req));
    if (!input.ok) return res.status(400).json({ error: input.error });
    const v = input.value;
    const [override] = await rows<GymOverrideRow>(
      `INSERT INTO gym_overrides (gym_id, name, address, phone, website, hours, description, features, prices, hidden, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::jsonb, $10, $11)
       ON CONFLICT (gym_id) DO UPDATE SET name = $2, address = $3, phone = $4, website = $5, hours = $6,
         description = $7, features = $8::text[], prices = $9::jsonb, hidden = $10, updated_by = $11, updated_at = now()
       RETURNING *`,
      [id, v.name, v.address, v.phone, v.website, v.hours, v.description, v.features, JSON.stringify(v.prices), v.hidden, adminId],
    );
    return res.status(200).json({ override });
  }

  if (req.method === 'DELETE') {
    await rows(
      `UPDATE gym_overrides SET name = NULL, address = NULL, phone = NULL, website = NULL, hours = NULL, description = NULL,
         features = NULL, prices = '{}'::jsonb, hidden = false, updated_by = $2, updated_at = now() WHERE gym_id = $1`,
      [id, adminId],
    );
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  res.status(405).json({ error: 'Method not allowed.' });
}

// POST   admin?resource=images {gymId, contentType, data (base64), alt}  ->  { image }
// PATCH  admin?resource=images {id, move: 'up'|'down'}                   ->  { ok }
// DELETE admin?resource=images&id=<uuid>                                 ->  { ok }
export async function adminImages(req: ApiRequest, res: ApiResponse, adminId: string) {
  if (req.method === 'POST') {
    const input = parseImageInput(bodyObject(req));
    if (!input.ok) return res.status(400).json({ error: input.error });
    const { gymId, contentType, base64, alt } = input.value;
    if (!isOsmGymId(gymId)) return res.status(400).json({ error: 'Registered gyms manage their own photos.' });

    const [{ n }] = await rows<{ n: number }>('SELECT count(*)::int AS n FROM gym_images WHERE gym_id = $1', [gymId]);
    if (n >= MAX_IMAGES_PER_GYM) return res.status(409).json({ error: `A gym can have up to ${MAX_IMAGES_PER_GYM} photos.` });

    // The gym appears in the admin's list as soon as it has a photo.
    await rows('INSERT INTO gym_overrides (gym_id, updated_by) VALUES ($1, $2) ON CONFLICT (gym_id) DO NOTHING', [gymId, adminId]);
    const [image] = await rows<{ id: string; alt: string | null; position: number }>(
      `INSERT INTO gym_images (gym_id, content_type, data, alt, position)
       VALUES ($1, $2, decode($3, 'base64'), $4, (SELECT coalesce(max(position) + 1, 0) FROM gym_images WHERE gym_id = $1))
       RETURNING id, alt, position`,
      [gymId, contentType, base64, alt],
    );
    return res.status(201).json({ image });
  }

  if (req.method === 'PATCH') {
    const body = bodyObject(req);
    if (!isUuid(body.id) || (body.move !== 'up' && body.move !== 'down')) return res.status(400).json({ error: 'Invalid request.' });
    const [target] = await rows<{ gym_id: string }>('SELECT gym_id FROM gym_images WHERE id = $1', [body.id]);
    if (!target) return res.status(404).json({ error: 'Image not found.' });

    const order = (await rows<{ id: string }>('SELECT id FROM gym_images WHERE gym_id = $1 ORDER BY position, created_at', [target.gym_id])).map(r => r.id);
    const from = order.indexOf(body.id);
    const to = body.move === 'up' ? from - 1 : from + 1;
    if (to >= 0 && to < order.length) {
      [order[from], order[to]] = [order[to], order[from]];
      await rows(
        'UPDATE gym_images SET position = v.pos FROM unnest($1::uuid[], $2::int[]) AS v(id, pos) WHERE gym_images.id = v.id',
        [order, order.map((_, i) => i)],
      );
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const id = queryParam(req, 'id');
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid image.' });
    const deleted = await rows('DELETE FROM gym_images WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) return res.status(404).json({ error: 'Image not found.' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE');
  res.status(405).json({ error: 'Method not allowed.' });
}
