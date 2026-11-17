import { haversineKm, type ApiGym, type Coordinates } from './geo.js';

// The one gym that tops every search, whatever the user types or filters.
// Source: https://maps.app.goo.gl/ZenQXUffuFz3xa76A
// The id has the same shape as a registered gym (vendor-<uuid>) so the gym page, booking and reviews accept it.
export const FEATURED_GYM: ApiGym = {
  id: 'vendor-00000000-0000-4000-8000-000000000001',
  name: 'Planet Muscle Performance & Fitness Centre',
  lat: 19.1274814,
  lon: 72.834737,
  address: 'Office 103, Ameya House, Rajkumar Corner, next to Standard Chartered Bank, near Azad Nagar Metro Station, Andheri West, Mumbai 400058',
  area: 'Andheri West',
  distanceKm: 0,
  hours: null,
  openNow: null,
  phone: null,
  website: 'https://maps.app.goo.gl/ZenQXUffuFz3xa76A',
  features: [],
  featured: true,
};

// The featured gym with its distance from the search point.
export function featuredGymFor(center: Coordinates): ApiGym {
  return { ...FEATURED_GYM, distanceKm: Math.round(haversineKm({ lat: FEATURED_GYM.lat, lon: FEATURED_GYM.lon }, center) * 10) / 10 };
}
