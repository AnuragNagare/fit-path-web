import { requireUser } from './_lib/auth.js';
import { enrichGyms } from './_lib/gym-data.js';
import { loadGym } from './_lib/gym-lookup.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

// GET /api/gym?id=node-123  ->  PublicGym | 404
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!(await requireUser(req, res))) return;

  const id = queryParam(req, 'id');
  if (!id) return res.status(400).json({ error: 'Missing id.' });

  try {
    const osm = await loadGym(id);
    const [gym] = osm ? await enrichGyms([osm]) : [];
    if (!gym) return res.status(404).json({ error: 'Gym not found.' });
    res.status(200).json(gym);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Gym lookup failed.' });
  }
}
