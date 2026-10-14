import { rows } from './db.js';
import { getGymById, haversineKm, type ApiGym, type Coordinates } from './geo.js';
import { normalizeProfile } from './vendor-model.js';
import { isVendorGymId } from './validate.js';

type LiveRow = { id: string; live: unknown; live_lat: number | null; live_lon: number | null };

// A registered gym as a search result, built from its approved (live) profile.
export function vendorApiGym(row: LiveRow, distanceKm = 0): ApiGym | null {
  const profile = normalizeProfile(row.live);
  if (row.live_lat === null || row.live_lon === null) return null;
  return {
    id: row.id,
    name: profile.name ?? 'Gym',
    lat: row.live_lat,
    lon: row.live_lon,
    address: profile.address,
    area: null,
    distanceKm,
    hours: profile.hours,
    openNow: null, // owners type opening hours as free text, so there is nothing to evaluate
    phone: profile.phone,
    website: profile.website,
    features: profile.features,
  };
}

// Any bookable gym by id: from the map (node-123) or a live registered gym (vendor-<uuid>).
// Suspended or not yet approved gyms are not found.
export async function loadGym(id: string): Promise<ApiGym | null> {
  if (!isVendorGymId(id)) return getGymById(id);
  const [row] = await rows<LiveRow>("SELECT id, live, live_lat, live_lon FROM vendor_gyms WHERE id = $1 AND status = 'live'", [id]);
  return row ? vendorApiGym(row) : null;
}

// Live registered gyms within `radiusKm` of a point (a box in SQL, then exact distance).
export async function findVendorGymsNearby(center: Coordinates, radiusKm: number): Promise<ApiGym[]> {
  const dLat = radiusKm / 110.574;
  const dLon = radiusKm / (111.32 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
  const found = await rows<LiveRow>(
    `SELECT id, live, live_lat, live_lon FROM vendor_gyms
     WHERE status = 'live' AND live_lat BETWEEN $1 AND $2 AND live_lon BETWEEN $3 AND $4 LIMIT 500`,
    [center.lat - dLat, center.lat + dLat, center.lon - dLon, center.lon + dLon],
  );
  const gyms: ApiGym[] = [];
  for (const row of found) {
    const gym = vendorApiGym(row);
    if (!gym) continue;
    const distanceKm = haversineKm({ lat: gym.lat, lon: gym.lon }, center);
    if (distanceKm > radiusKm) continue;
    gyms.push({ ...gym, distanceKm: Math.round(distanceKm * 10) / 10 });
  }
  return gyms;
}
