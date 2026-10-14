import { requireUser } from './_lib/auth.js';
import { enrichGyms } from './_lib/gym-data.js';
import { findGymsNearby } from './_lib/geo.js';
import { findVendorGymsNearby } from './_lib/gym-lookup.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 10;

// GET /api/gyms?lat&lon[&radiusKm]  ->  { gyms: PublicGym[] }  (gyms near the point, nearest first, with admin edits, images, prices and ratings)
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!(await requireUser(req, res))) return;

  const lat = Number(queryParam(req, 'lat'));
  const lon = Number(queryParam(req, 'lon'));
  if (!queryParam(req, 'lat') || !queryParam(req, 'lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat and lon are required numbers.' });
  }

  const requested = Number(queryParam(req, 'radiusKm'));
  const radiusKm = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_RADIUS_KM) : DEFAULT_RADIUS_KM;

  try {
    const center = { lat, lon };
    // Gyms registered by their owners come from our database and are found even if the map service is down.
    const [osm, vendors] = await Promise.all([
      findGymsNearby(center, radiusKm).then(gyms => ({ gyms, error: null as unknown }), error => ({ gyms: [], error: error as unknown })),
      findVendorGymsNearby(center, radiusKm).catch(() => []),
    ]);
    if (osm.error && vendors.length === 0) throw osm.error;
    const nearby = [...osm.gyms, ...vendors].sort((a, b) => a.distanceKm - b.distanceKm);
    res.status(200).json({ gyms: await enrichGyms(nearby) });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Gym lookup failed.' });
  }
}
