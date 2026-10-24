import { requireUser } from './_lib/auth.js';
import { enrichGyms } from './_lib/gym-data.js';
import { findGymsNearby } from './_lib/geo.js';
import { findVendorGymsNearby } from './_lib/gym-lookup.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 25;

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
    let [osm, vendors] = await Promise.all([
      findGymsNearby(center, radiusKm).then(gyms => ({ gyms, error: null as unknown }), error => ({ gyms: [], error: error as unknown })),
      findVendorGymsNearby(center, radiusKm).catch(() => []),
    ]);

    // Progressive radius fallback: if fewer than 4 gyms are found in the default 10 km radius,
    // automatically search up to 15 km so users in suburban/lower-density areas receive relevant results.
    if (osm.gyms.length + vendors.length < 4 && !Number.isFinite(requested)) {
      const fallbackRadius = 15;
      const [osmFallback, vendorsFallback] = await Promise.all([
        findGymsNearby(center, fallbackRadius).then(gyms => ({ gyms, error: null as unknown }), () => ({ gyms: [], error: null })),
        findVendorGymsNearby(center, fallbackRadius).catch(() => []),
      ]);
      if (osmFallback.gyms.length + vendorsFallback.length > osm.gyms.length + vendors.length) {
        osm = osmFallback;
        vendors = vendorsFallback;
      }
    }

    if (osm.error && vendors.length === 0) throw osm.error;
    const nearby = [...osm.gyms, ...vendors].sort((a, b) => a.distanceKm - b.distanceKm);
    res.status(200).json({ gyms: await enrichGyms(nearby) });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Gym lookup failed.' });
  }
}
