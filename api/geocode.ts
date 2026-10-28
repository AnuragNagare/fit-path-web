import { requireUser } from './_lib/auth.js';
import { geocode } from './_lib/geo.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

// GET /api/geocode?q=London  ->  { lat, lon, displayName } | 404
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!(await requireUser(req, res))) return;

  const q = queryParam(req, 'q')?.trim();
  if (!q) return res.status(400).json({ error: 'Missing q.' });

  try {
    const result = await geocode(q);
    if (!result) return res.status(404).json({ error: `Couldn't find "${q}". Try adding the city or country.` });
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Location lookup failed.' });
  }
}
