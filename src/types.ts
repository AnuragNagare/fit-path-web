export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface RouteQuery {
  from: Place;
  to: Place | null; // null = gyms near `from` instead of along a route
  startDate: string;
  endDate: string;
  people: number;
}

// Gym as returned by /api/gyms and /api/gym (real OpenStreetMap data).
export interface Gym {
  id: string; // e.g. "node-123456"
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  area: string | null; // suburb or city
  distanceKm: number; // distance from the route (or from `from` in nearby mode)
  hours: string | null;
  openNow: boolean | null; // null when opening hours are unknown
  phone: string | null;
  website: string | null;
  features: string[]; // feature ids (see src/data/features.ts)
}

export interface RouteInfo {
  type: 'road' | 'straight'; // 'straight' = road routing was unavailable
  coordinates: [number, number][]; // [lat, lon]
  distanceKm: number;
  durationMin: number | null;
}

export interface SearchResult {
  gyms: Gym[];
  route: RouteInfo | null; // null in nearby mode
}
