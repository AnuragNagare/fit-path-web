import { rows } from './db.js';
import type { ApiGym } from './geo.js';
import { resolvePrices, type PartialPlanPrices, type Plan, type PlanPrices } from './plans.js';
import { normalizeProfile } from './vendor-model.js';
import { isVendorGymId } from './validate.js';

// What the database adds on top of an OpenStreetMap gym.
export type GymOverrideRow = {
  gym_id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  description: string | null;
  features: string[] | null;
  prices: PartialPlanPrices;
  hidden: boolean;
};

// A photo or video shown on the gym page. `url` is ready to use in an <img> or <video>.
export type GymMedia = { id: string; kind: 'photo' | 'video'; url: string; alt: string | null };

export type GymMeta = {
  override: GymOverrideRow | null;
  images: GymMedia[];
  videos: GymMedia[];
  rating: number | null; // average of visible reviews, one decimal
  reviewCount: number;
};

export type PublicGym = ApiGym & {
  description: string | null;
  images: GymMedia[];
  videos: GymMedia[];
  prices: PlanPrices; // real where the gym set one, otherwise a sample price
  bookable: Plan[]; // plans that have a real price
  rating: number | null;
  reviewCount: number;
};

export const emptyMeta = (): GymMeta => ({ override: null, images: [], videos: [], rating: null, reviewCount: 0 });

// Layers the admin's edits, media, prices and review stats onto a gym.
// Returns null when the admin has hidden the gym.
export function applyMeta(gym: ApiGym, meta: GymMeta): PublicGym | null {
  const o = meta.override;
  if (o?.hidden) return null;
  const { prices, bookable } = resolvePrices(gym.id, o?.prices);
  return {
    ...gym,
    name: o?.name ?? gym.name,
    address: o?.address ?? gym.address,
    phone: o?.phone ?? gym.phone,
    website: o?.website ?? gym.website,
    hours: o?.hours ?? gym.hours,
    features: o?.features ?? gym.features,
    description: o?.description ?? null,
    images: meta.images,
    videos: meta.videos,
    prices,
    bookable,
    rating: meta.rating,
    reviewCount: meta.reviewCount,
  };
}

export function ratingStats(sum: number, count: number): { rating: number | null; reviewCount: number } {
  return { rating: count > 0 ? Math.round((sum / count) * 10) / 10 : null, reviewCount: count };
}

// One round of queries for any number of gyms, from the map or registered by owners.
export async function loadGymMeta(ids: string[]): Promise<Map<string, GymMeta>> {
  const metas = new Map<string, GymMeta>(ids.map(id => [id, emptyMeta()]));
  if (ids.length === 0) return metas;
  const vendorIds = ids.filter(isVendorGymId);
  const osmIds = ids.filter(id => !isVendorGymId(id));

  const [overrides, images, stats, vendors, vendorMedia] = await Promise.all([
    osmIds.length ? rows<GymOverrideRow>('SELECT * FROM gym_overrides WHERE gym_id = ANY($1::text[])', [osmIds]) : [],
    osmIds.length
      ? rows<{ id: string; gym_id: string; alt: string | null }>(
          'SELECT id, gym_id, alt FROM gym_images WHERE gym_id = ANY($1::text[]) ORDER BY position, created_at',
          [osmIds],
        )
      : [],
    rows<{ gym_id: string; sum: string; n: string }>(
      'SELECT gym_id, sum(rating) AS sum, count(*) AS n FROM reviews WHERE gym_id = ANY($1::text[]) AND NOT hidden GROUP BY gym_id',
      [ids],
    ),
    vendorIds.length ? rows<{ id: string; live: unknown }>("SELECT id, live FROM vendor_gyms WHERE id = ANY($1::text[]) AND status = 'live'", [vendorIds]) : [],
    // Until the admin approves a removal, the photo or video stays on the public page.
    vendorIds.length
      ? rows<{ id: string; gym_id: string; kind: 'photo' | 'video'; url: string; alt: string | null }>(
          "SELECT id, gym_id, kind, url, alt FROM vendor_media WHERE gym_id = ANY($1::text[]) AND status IN ('approved', 'pending_remove') ORDER BY position, created_at",
          [vendorIds],
        )
      : [],
  ]);

  for (const o of overrides) {
    const meta = metas.get(o.gym_id);
    if (meta) meta.override = o;
  }
  for (const img of images) {
    metas.get(img.gym_id)?.images.push({ id: img.id, kind: 'photo', url: `/api/image?id=${img.id}`, alt: img.alt });
  }
  for (const v of vendors) {
    const meta = metas.get(v.id);
    if (!meta) continue;
    const profile = normalizeProfile(v.live);
    meta.override = {
      gym_id: v.id, name: null, address: null, phone: null, website: null, hours: null, features: null,
      description: profile.description, prices: profile.prices, hidden: false,
    };
  }
  for (const m of vendorMedia) {
    const item: GymMedia = { id: m.id, kind: m.kind, url: m.url, alt: m.alt };
    metas.get(m.gym_id)?.[m.kind === 'photo' ? 'images' : 'videos'].push(item);
  }
  for (const s of stats) {
    const meta = metas.get(s.gym_id);
    if (meta) Object.assign(meta, ratingStats(Number(s.sum), Number(s.n)));
  }
  return metas;
}

// Gyms with the database layer applied. If the database is unreachable the search still works, with
// plain map data and sample prices.
export async function enrichGyms(gyms: ApiGym[]): Promise<PublicGym[]> {
  let metas = new Map<string, GymMeta>();
  try {
    metas = await loadGymMeta(gyms.map(g => g.id));
  } catch (err) {
    console.error('gym metadata unavailable', err instanceof Error ? err.message : err);
  }
  return gyms.flatMap(g => applyMeta(g, metas.get(g.id) ?? emptyMeta()) ?? []);
}
