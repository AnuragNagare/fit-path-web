// Real location + gym data, backed by free OpenStreetMap services:
// - Nominatim for geocoding (address <-> coordinates)
// - Overpass API for querying real gyms near a point
// No API key required. Be mindful of their public rate limits for heavy use.
//
// The actual Nominatim/Overpass calls run inside TanStack Start server functions
// (createServerFn) instead of directly in the browser. Both services are unreliable
// about sending CORS headers to browser requests, which breaks in production even
// when it works in local dev. Running server-to-server avoids CORS entirely and lets
// us send a proper User-Agent, as Nominatim's usage policy asks for.

import { createServerFn } from "@tanstack/react-start";

export type Coordinates = { lat: number; lon: number };

export type GymResult = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string | null;
};

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "FitPath/1.0 (gym finder app)",
};

// Nominatim/Overpass are free, unauthenticated public services and occasionally
// hiccup with a transient network error, a 429 (rate limited), or a 5xx — a
// retry a moment later usually just works. Only retry on those; don't retry
// on a clean 4xx like a malformed query.
async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (!res.ok && retries > 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fetchWithRetry(url, init, retries - 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fetchWithRetry(url, init, retries - 1);
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

// Flattens a small lat/lon neighborhood onto a local km-scale plane (equirectangular,
// referenced at `a`) so we can do simple 2D point-to-segment math. Fine at the
// city/route scale this is used for (route legs are capped at MAX_ROUTE_KM below);
// it isn't meant for anything approaching global distances.
function toLocalXY(p: Coordinates, ref: Coordinates): { x: number; y: number } {
  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos((ref.lat * Math.PI) / 180);
  return { x: (p.lon - ref.lon) * kmPerDegLon, y: (p.lat - ref.lat) * kmPerDegLat };
}

// Perpendicular distance from `point` to the straight line segment a->b, in km —
// used to keep only gyms that sit close to an A-to-B route rather than just near
// one endpoint.
export function distanceToSegmentKm(point: Coordinates, a: Coordinates, b: Coordinates): number {
  const p = toLocalXY(point, a);
  const end = toLocalXY(b, a);
  const lengthSq = end.x * end.x + end.y * end.y;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (p.x * end.x + p.y * end.y) / lengthSq));
  const closest = { x: end.x * t, y: end.y * t };
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function requestPosition(options: PositionOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      reject,
      options,
    );
  });
}

export function getCurrentPosition(): Promise<Coordinates> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("Geolocation isn't supported in this browser."));
  }
  // A high-accuracy GPS lock can take a while (or never arrive indoors / on
  // desktop), which was throwing "Timeout expired" too eagerly. Give it a
  // generous window, then fall back to a faster, lower-accuracy (network/IP)
  // lookup instead of failing outright.
  return requestPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }).catch(() =>
    requestPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }).catch(
      (error: GeolocationPositionError) => {
        throw new Error(error.message || "Couldn't get your location.");
      },
    ),
  );
}

// India's bounding box (west,south,east,north), used to keep manual location
// search — "near me" search and route A/B points alike — resolving to Indian
// places instead of a same-named location anywhere in the world.
const INDIA_VIEWBOX = "68.0,6.5,97.5,37.5";

const geocodeAddressFn = createServerFn({ method: "GET" })
  .validator((query: string) => query)
  .handler(async ({ data: query }) => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&viewbox=${INDIA_VIEWBOX}&bounded=1&q=${encodeURIComponent(query)}`;
    const res = await fetchWithRetry(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) throw new Error("Location lookup failed. Please try again.");
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const first = data[0];
    if (!first) return null;
    return {
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      displayName: first.display_name,
    };
  });

export async function geocodeAddress(
  query: string,
): Promise<(Coordinates & { displayName: string }) | null> {
  return geocodeAddressFn({ data: query });
}

const reverseGeocodeFn = createServerFn({ method: "GET" })
  .validator((coords: Coordinates) => coords)
  .handler(async ({ data: coords }) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`;
    const res = await fetchWithRetry(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) throw new Error("Could not resolve that address.");
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`;
  });

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  return reverseGeocodeFn({ data: coords });
}

type OverpassElement = {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// `filterExpr` is whatever goes inside Overpass QL's `(...)` position after each
// tag filter — either an `around:radius,lat,lon` clause or a plain
// `south,west,north,east` bbox — so both the near-me and route searches below
// can share the same query shape and fetch/error handling.
async function queryOverpassGyms(filterExpr: string): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:25];(node["leisure"="fitness_centre"](${filterExpr});way["leisure"="fitness_centre"](${filterExpr});node["amenity"="gym"](${filterExpr});way["amenity"="gym"](${filterExpr}););out center tags;`;
  const res = await fetchWithRetry("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "FitPath/1.0 (gym finder app)",
    },
  });
  if (!res.ok) throw new Error("Gym search failed. Please try again in a moment.");
  const data = (await res.json()) as { elements: OverpassElement[] };
  return data.elements;
}

// Converts raw Overpass elements into de-duplicated GymResults. `distanceKm`
// is supplied by the caller since near-me search ranks by distance from a
// center point while route search ranks by distance off the A-to-B line.
function parseOverpassGyms(
  elements: OverpassElement[],
  distanceKm: (lat: number, lon: number) => number,
): GymResult[] {
  const seen = new Set<string>();
  const results: GymResult[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.["name"];
    if (lat === undefined || lon === undefined || !name) continue;
    const key = `${name}-${lat.toFixed(4)}-${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const streetParts = [el.tags?.["addr:housenumber"], el.tags?.["addr:street"]].filter(Boolean);
    const address = streetParts.length
      ? streetParts.join(" ")
      : (el.tags?.["addr:suburb"] ?? el.tags?.["addr:city"] ?? null);
    results.push({
      id: `${el.type}-${el.id}`,
      name,
      lat,
      lon,
      distanceKm: distanceKm(lat, lon),
      address,
    });
  }
  return results;
}

const fetchNearbyGymsFn = createServerFn({ method: "GET" })
  .validator((input: { center: Coordinates; radiusMeters: number }) => input)
  .handler(async ({ data: { center, radiusMeters } }) => {
    const elements = await queryOverpassGyms(`around:${radiusMeters},${center.lat},${center.lon}`);
    return parseOverpassGyms(elements, (lat, lon) => haversineKm(center, { lat, lon }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);
  });

export async function fetchNearbyGyms(
  center: Coordinates,
  radiusMeters = 5000,
): Promise<GymResult[]> {
  return fetchNearbyGymsFn({ data: { center, radiusMeters } });
}

// How far off the straight line between start and end a gym can be and still
// count as "along the route".
const ROUTE_CORRIDOR_KM = 2;
// Overpass bbox queries scale with area, and a route this long isn't really
// what "gyms along my route" means for a city-scale product — cap it and ask
// for closer points instead of running a huge, slow query.
const MAX_ROUTE_KM = 100;

const fetchGymsAlongRouteFn = createServerFn({ method: "GET" })
  .validator((input: { start: Coordinates; end: Coordinates }) => input)
  .handler(async ({ data: { start, end } }) => {
    const routeLengthKm = haversineKm(start, end);
    if (routeLengthKm > MAX_ROUTE_KM) {
      throw new Error(
        `Start and end are ${Math.round(routeLengthKm)} km apart — pick two points less than ${MAX_ROUTE_KM} km apart.`,
      );
    }
    // Pad the bbox by the corridor width (plus a little slack) so gyms near
    // the route's edges aren't clipped just because they sit outside the
    // start/end points' own bounding box.
    const padDeg = (ROUTE_CORRIDOR_KM + 3) / 111;
    const south = Math.min(start.lat, end.lat) - padDeg;
    const north = Math.max(start.lat, end.lat) + padDeg;
    const west = Math.min(start.lon, end.lon) - padDeg;
    const east = Math.max(start.lon, end.lon) + padDeg;

    const elements = await queryOverpassGyms(`${south},${west},${north},${east}`);
    return parseOverpassGyms(elements, (lat, lon) => distanceToSegmentKm({ lat, lon }, start, end))
      .filter((gym) => gym.distanceKm <= ROUTE_CORRIDOR_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);
  });

export async function fetchGymsAlongRoute(start: Coordinates, end: Coordinates): Promise<GymResult[]> {
  return fetchGymsAlongRouteFn({ data: { start, end } });
}
