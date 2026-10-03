import { requireUser } from './_lib/auth.js';
import { findGymsAlongRoute, findGymsNearby, getRoute, haversineKm, MAX_ROUTE_KM } from './_lib/geo.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

const DEFAULT_RADIUS_KM = 3;
const MAX_RADIUS_KM = 10;

// GET /api/gyms?fromLat&fromLon[&toLat&toLon][&radiusKm]
//   with toLat/toLon  ->  { gyms: ApiGym[], route: RouteInfo }  (gyms along the road A -> B)
//   without           ->  { gyms: ApiGym[], route: null }       (gyms near the from point)
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!(await requireUser(req, res))) return;

  const fromLat = Number(queryParam(req, 'fromLat'));
  const fromLon = Number(queryParam(req, 'fromLon'));
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon)) {
    return res.status(400).json({ error: 'fromLat and fromLon are required numbers.' });
  }
  const a = { lat: fromLat, lon: fromLon };

  const rawToLat = queryParam(req, 'toLat');
  const rawToLon = queryParam(req, 'toLon');
  const hasTo = rawToLat !== undefined || rawToLon !== undefined;
  const toLat = Number(rawToLat);
  const toLon = Number(rawToLon);
  if (hasTo && (!Number.isFinite(toLat) || !Number.isFinite(toLon))) {
    return res.status(400).json({ error: 'toLat and toLon must both be numbers.' });
  }

  const requested = Number(queryParam(req, 'radiusKm'));
  const radiusKm = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_RADIUS_KM) : DEFAULT_RADIUS_KM;

  try {
    if (!hasTo) {
      return res.status(200).json({ gyms: await findGymsNearby(a, radiusKm), route: null });
    }

    const b = { lat: toLat, lon: toLon };
    if (haversineKm(a, b) > MAX_ROUTE_KM) {
      return res.status(400).json({ error: `Route is too long. Keep it under ${MAX_ROUTE_KM} km.` });
    }
    const route = await getRoute(a, b);
    res.status(200).json({ gyms: await findGymsAlongRoute(route, radiusKm), route });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Gym lookup failed.' });
  }
}
