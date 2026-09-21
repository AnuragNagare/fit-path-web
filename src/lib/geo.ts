// Real location + gym data, backed by free OpenStreetMap services:
// - Nominatim for geocoding (address <-> coordinates)
// - Overpass API for querying real gyms near a point
// No API key required. Be mindful of their public rate limits for heavy use.

export type Coordinates = { lat: number; lon: number };

export type GymResult = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string | null;
};

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation isn't supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => reject(new Error(error.message || "Couldn't get your location.")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export async function geocodeAddress(query: string): Promise<(Coordinates & { displayName: string }) | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Location lookup failed. Please try again.");
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon), displayName: first.display_name };
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not resolve that address.");
  const data = (await res.json()) as { display_name?: string };
  return data.display_name ?? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`;
}

type OverpassElement = {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function fetchNearbyGyms(center: Coordinates, radiusMeters = 5000): Promise<GymResult[]> {
  const around = `around:${radiusMeters},${center.lat},${center.lon}`;
  const query = `[out:json][timeout:25];(node["leisure"="fitness_centre"](${around});way["leisure"="fitness_centre"](${around});node["amenity"="gym"](${around});way["amenity"="gym"](${around}););out center tags;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error("Gym search failed. Please try again in a moment.");
  const data = (await res.json()) as { elements: OverpassElement[] };

  const seen = new Set<string>();
  const results: GymResult[] = [];
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.["name"];
    if (lat === undefined || lon === undefined || !name) continue;
    const key = `${name}-${lat.toFixed(4)}-${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const streetParts = [el.tags?.["addr:housenumber"], el.tags?.["addr:street"]].filter(Boolean);
    const address = streetParts.length ? streetParts.join(" ") : (el.tags?.["addr:suburb"] ?? el.tags?.["addr:city"] ?? null);
    results.push({ id: `${el.type}-${el.id}`, name, lat, lon, distanceKm: haversineKm(center, { lat, lon }), address });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
}
