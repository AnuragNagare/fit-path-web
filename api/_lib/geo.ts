// Real location + gym data from free OpenStreetMap services:
// - Nominatim for geocoding (place name -> coordinates)
// - Overpass for querying real gyms
// No API key needed; both have public rate limits, so calls retry once on 429/5xx.
// Ported from the FitPath app's geo helpers.

import OpeningHours from 'opening_hours';

export type Coordinates = { lat: number; lon: number };

export type ApiGym = {
  id: string; // e.g. "node-123456", safe to use in a URL path
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  area: string | null; // suburb or city, for the list row
  distanceKm: number; // distance from the route, or from the centre in nearby mode
  hours: string | null;
  openNow: boolean | null; // null when OSM has no (parseable) opening hours
  phone: string | null;
  website: string | null;
  features: string[]; // feature ids from src/data/features.ts that OSM tags confirm
};

export type RouteInfo = {
  type: 'road' | 'straight'; // 'straight' = routing service was unavailable
  coordinates: [number, number][]; // [lat, lon] pairs along the route
  distanceKm: number;
  durationMin: number | null;
};

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Trace/1.0 (gym finder app)',
};

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIRROR_URL = 'https://overpass.private.coffee/api/interpreter';
// Country-wide counts are too heavy for the main server, which rejects them as busy.
const OVERPASS_HEAVY_URLS = [OVERPASS_MIRROR_URL, OVERPASS_URL];

export const MAX_ROUTE_KM = 150;

// `timeoutMs` caps each attempt: a hung connection otherwise never errors, so the retry and
// mirror fallbacks would never start.
async function fetchWithRetry(url: string, init: RequestInit, retries = 1, delayMs = 800, timeoutMs = 15_000): Promise<Response> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok && retries > 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return fetchWithRetry(url, init, retries - 1, delayMs * 2, timeoutMs);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return fetchWithRetry(url, init, retries - 1, delayMs * 2, timeoutMs);
    }
    throw err;
  }
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toLocalXY(p: Coordinates, ref: Coordinates) {
  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos((ref.lat * Math.PI) / 180);
  return { x: (p.lon - ref.lon) * kmPerDegLon, y: (p.lat - ref.lat) * kmPerDegLat };
}

// Perpendicular distance in km from `point` to the segment a->b (city/route scale only).
export function distanceToSegmentKm(point: Coordinates, a: Coordinates, b: Coordinates): number {
  const p = toLocalXY(point, a);
  const end = toLocalXY(b, a);
  const lengthSq = end.x * end.x + end.y * end.y;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (p.x * end.x + p.y * end.y) / lengthSq));
  return Math.hypot(p.x - end.x * t, p.y - end.y * t);
}

// India's bounding box (west,south,east,north): keeps lookups from resolving to a
// same-named place elsewhere in the world.
const INDIA_VIEWBOX = '68.0,6.5,97.5,37.5';

export async function geocode(query: string): Promise<(Coordinates & { displayName: string }) | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&viewbox=${INDIA_VIEWBOX}&bounded=1&q=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url, { headers: HEADERS });
  if (!res.ok) throw new Error('Location lookup failed. Please try again.');
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon), displayName: first.display_name };
}

type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const yes = (v: string | undefined) => v === 'yes';
const sportHas = (tags: Record<string, string>, ...words: string[]) => {
  const sport = (tags.sport ?? '').split(';');
  return words.some(w => sport.includes(w));
};

// Only features OSM can actually confirm are returned; ids match src/data/features.ts.
export function featuresFromTags(tags: Record<string, string>): string[] {
  const out: string[] = [];
  if (tags.opening_hours === '24/7') out.push('24x7');
  if (yes(tags.swimming_pool) || yes(tags.pool) || sportHas(tags, 'swimming')) out.push('pool');
  if (yes(tags.sauna)) out.push('sauna');
  if (yes(tags.steam_room)) out.push('steam');
  if (yes(tags.shower)) out.push('shower');
  if (yes(tags.lockers)) out.push('lockers');
  if (yes(tags.changing_room)) out.push('changing');
  if (yes(tags.air_conditioning)) out.push('ac');
  if (yes(tags.drinking_water)) out.push('water');
  if (tags.wheelchair === 'yes') out.push('wheelchair');
  if (tags.female === 'only') out.push('women_only');
  if (tags.parking && tags.parking !== 'no') out.push('parking');
  if (sportHas(tags, 'yoga')) out.push('yoga');
  if (sportHas(tags, 'dance')) out.push('zumba');
  if (sportHas(tags, 'boxing', 'kickboxing', 'martial_arts', 'mma')) out.push('boxing');
  if (sportHas(tags, 'weightlifting', 'powerlifting', 'bodybuilding')) out.push('free_weights');
  if (sportHas(tags, 'crossfit')) out.push('hiit');
  return out;
}

function formatAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [street, tags['addr:suburb'], tags['addr:city'] ?? tags['addr:town']].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// The app is India-only and India has no daylight saving, so evaluate opening hours on
// India's wall clock: shift "now" so the server's local getters read IST (UTC+5:30).
function isOpenNow(hours: string | undefined): boolean | null {
  if (!hours) return null;
  try {
    const now = new Date();
    const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000);
    return new OpeningHours(hours).getState(ist);
  } catch {
    return null;
  }
}

function toApiGym(el: OsmElement, distanceKm: number): ApiGym | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  return {
    id: `${el.type}-${el.id}`,
    name: tags.name ?? 'Unnamed gym',
    lat,
    lon,
    address: formatAddress(tags),
    area: tags['addr:suburb'] ?? tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:district'] ?? null,
    distanceKm,
    hours: tags.opening_hours ?? null,
    openNow: isOpenNow(tags.opening_hours),
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    features: featuresFromTags(tags),
  };
}

async function overpass(query: string): Promise<OsmElement[]> {
  const init = {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  };
  // The public servers rate-limit bursts and sometimes time out, so back off on the main
  // server, then try a mirror before giving up.
  for (const [url, retries] of [[OVERPASS_URL, 1], [OVERPASS_MIRROR_URL, 0]] as const) {
    try {
      // Overpass ends its own queries at 25 s ([timeout:25]), so allow a little longer than that.
      const res = await fetchWithRetry(url, init, retries, 1500, 30_000);
      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      // A query that ran out of time still answers 200, with a "runtime error" remark and no elements.
      if (data.remark?.includes('runtime error')) continue;
      return data.elements ?? [];
    } catch {
      // network error or non-JSON reply: try the next server
    }
  }
  throw new Error('Gym lookup failed. The map data service is busy, please try again.');
}

const GYM_FILTER = '["leisure"~"^(fitness_centre|sports_centre)$"]';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// Drives from a to b along real roads (OSRM public server). Falls back to the straight
// line when routing is unavailable so a search still works.
export async function getRoute(a: Coordinates, b: Coordinates): Promise<RouteInfo> {
  try {
    const url = `${OSRM_URL}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetchWithRetry(url, { headers: HEADERS });
    if (!res.ok) throw new Error('routing failed');
    const data = (await res.json()) as {
      code: string;
      routes?: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>;
    };
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) throw new Error('no route');
    return {
      type: 'road',
      coordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return {
      type: 'straight',
      coordinates: [[a.lat, a.lon], [b.lat, b.lon]],
      distanceKm: Math.round(haversineKm(a, b) * 10) / 10,
      durationMin: null,
    };
  }
}

function distanceToPathKm(point: Coordinates, path: Coordinates[]): number {
  if (path.length === 1) return haversineKm(point, path[0]);
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    min = Math.min(min, distanceToSegmentKm(point, path[i], path[i + 1]));
  }
  return min;
}

// Douglas-Peucker: drops points within `toleranceKm` of the line so the Overpass query stays small.
function simplifyPath(path: Coordinates[], toleranceKm: number): Coordinates[] {
  if (path.length <= 2) return path;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const d = distanceToSegmentKm(path[i], path[0], path[path.length - 1]);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist <= toleranceKm) return [path[0], path[path.length - 1]];
  const left = simplifyPath(path.slice(0, index + 1), toleranceKm);
  return [...left.slice(0, -1), ...simplifyPath(path.slice(index), toleranceKm)];
}

// Gyms within `radiusKm` of the route path, nearest to the route first.
export async function findGymsAlongRoute(route: RouteInfo, radiusKm: number): Promise<ApiGym[]> {
  const path = route.coordinates.map(([lat, lon]) => ({ lat, lon }));
  let simplified = simplifyPath(path, 0.2);
  // Keep the query short for very twisty routes.
  for (let tol = 0.5; simplified.length > 80; tol *= 2) simplified = simplifyPath(path, tol);

  const around = simplified.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(',');
  const elements = await overpass(
    `[out:json][timeout:25];nwr${GYM_FILTER}(around:${radiusKm * 1000},${around});out center tags 500;`,
  );

  const gyms: ApiGym[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const distanceKm = distanceToPathKm({ lat, lon }, path);
    if (distanceKm > radiusKm) continue;
    const gym = toApiGym(el, Math.round(distanceKm * 10) / 10);
    if (gym) gyms.push(gym);
  }
  return gyms.sort((x, y) => x.distanceKm - y.distanceKm);
}

// Gyms within `radiusKm` of a single point, nearest first.
export async function findGymsNearby(center: Coordinates, radiusKm: number): Promise<ApiGym[]> {
  const elements = await overpass(
    `[out:json][timeout:25];nwr${GYM_FILTER}(around:${radiusKm * 1000},${center.lat.toFixed(5)},${center.lon.toFixed(5)});out center tags 500;`,
  );

  const gyms: ApiGym[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const distanceKm = haversineKm({ lat, lon }, center);
    if (distanceKm > radiusKm) continue;
    const gym = toApiGym(el, Math.round(distanceKm * 10) / 10);
    if (gym) gyms.push(gym);
  }
  return gyms.sort((x, y) => x.distanceKm - y.distanceKm);
}

export async function getGymById(id: string): Promise<ApiGym | null> {
  const match = /^(node|way|relation)-(\d+)$/.exec(id);
  if (!match) return null;
  const elements = await overpass(`[out:json][timeout:25];${match[1]}(${match[2]});out center tags;`);
  const el = elements[0];
  return el ? toApiGym(el, 0) : null;
}

// Number of gyms in India in OpenStreetMap. Slow (one to two minutes), so callers cache it.
export async function countGymsInIndia(): Promise<number> {
  const query = `[out:json][timeout:180];area["ISO3166-1"="IN"][admin_level=2]->.in;nwr${GYM_FILTER}(area.in);out count;`;
  for (const url of OVERPASS_HEAVY_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: Array<{ tags?: { total?: string } }>; remark?: string };
      // A query cut short (time or memory limit) still answers 200, with a partial count and a remark.
      if (data.remark) continue;
      const total = Number(data.elements?.[0]?.tags?.total);
      if (Number.isFinite(total) && total > 0) return total;
    } catch {
      // try the next server
    }
  }
  throw new Error('Gym count unavailable.');
}
