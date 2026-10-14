import { isPlan, PLANS, type PartialPlanPrices, type Plan } from './plans.js';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const OSM_GYM_ID = /^(node|way|relation)-\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VENDOR_GYM_ID = /^vendor-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A gym from the map (node-123) or one a gym owner registered (vendor-<uuid>).
export const isGymId = (v: unknown): v is string => typeof v === 'string' && (OSM_GYM_ID.test(v) || VENDOR_GYM_ID.test(v));
export const isOsmGymId = (v: unknown): v is string => typeof v === 'string' && OSM_GYM_ID.test(v);
export const isVendorGymId = (v: unknown): v is string => typeof v === 'string' && VENDOR_GYM_ID.test(v);
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

// A trimmed string up to `max` characters; '' and null become null; anything else is an error.
export function text(value: unknown, max: number): Parsed<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return fail('Expected text.');
  const trimmed = value.trim();
  if (trimmed.length > max) return fail(`Keep it under ${max} characters.`);
  return { ok: true, value: trimmed === '' ? null : trimmed };
}

// ── Bookings ──

export type BookingInput = { gymId: string; plan: Plan; people: number };

export function parseBookingInput(body: Record<string, unknown>): Parsed<BookingInput> {
  if (!isGymId(body.gymId)) return fail('Invalid gym.');
  if (!isPlan(body.plan)) return fail('Choose a plan.');
  const people = body.people;
  if (typeof people !== 'number' || !Number.isInteger(people) || people < 1 || people > 99) {
    return fail('Number of people must be between 1 and 99.');
  }
  return { ok: true, value: { gymId: body.gymId, plan: body.plan, people } };
}

// ── Reviews ──

export type ReviewInput = { gymId: string; rating: number; body: string | null };

export function parseReviewInput(body: Record<string, unknown>): Parsed<ReviewInput> {
  if (!isGymId(body.gymId)) return fail('Invalid gym.');
  const rating = body.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail('Rating must be 1 to 5 stars.');
  }
  const text_ = text(body.body, 1000);
  if (!text_.ok) return fail(`Review: ${text_.error}`);
  return { ok: true, value: { gymId: body.gymId, rating, body: text_.value } };
}

// ── Gym overrides (admin) ──

export type OverrideInput = {
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  description: string | null;
  features: string[] | null; // null = keep the map's features
  prices: PartialPlanPrices;
  hidden: boolean;
};

export function parseOverrideInput(body: Record<string, unknown>): Parsed<OverrideInput> {
  const fields = { name: 120, address: 200, phone: 40, website: 300, hours: 200, description: 2000 } as const;
  const out: Record<string, string | null> = {};
  for (const [key, max] of Object.entries(fields)) {
    const parsed = text(body[key], max);
    if (!parsed.ok) return fail(`${key}: ${parsed.error}`);
    out[key] = parsed.value;
  }
  if (out.website && !/^https?:\/\/\S+$/i.test(out.website)) return fail('Website must start with http:// or https://.');

  let features: string[] | null = null;
  if (body.features !== undefined && body.features !== null) {
    const list = body.features;
    if (!Array.isArray(list) || list.length > 60 || !list.every(f => typeof f === 'string' && /^[a-z0-9_]{1,40}$/.test(f))) {
      return fail('Invalid features.');
    }
    features = Array.from(new Set(list as string[]));
  }

  const prices: PartialPlanPrices = {};
  const rawPrices = body.prices;
  if (rawPrices !== undefined && rawPrices !== null) {
    if (typeof rawPrices !== 'object' || Array.isArray(rawPrices)) return fail('Invalid prices.');
    for (const plan of PLANS) {
      const v = (rawPrices as Record<string, unknown>)[plan];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 1_000_000) {
        return fail(`${plan} price must be a whole number of rupees between 1 and 1,000,000.`);
      }
      prices[plan] = v;
    }
  }

  if (body.hidden !== undefined && typeof body.hidden !== 'boolean') return fail('Invalid hidden flag.');

  return {
    ok: true,
    value: {
      name: out.name,
      address: out.address,
      phone: out.phone,
      website: out.website,
      hours: out.hours,
      description: out.description,
      features,
      prices,
      hidden: body.hidden === true,
    },
  };
}

// ── Gym images (admin) ──

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // the browser shrinks photos well below this first
export const MAX_IMAGES_PER_GYM = 10;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageInput = { gymId: string; contentType: (typeof IMAGE_TYPES)[number]; base64: string; alt: string | null };

export function parseImageInput(body: Record<string, unknown>): Parsed<ImageInput> {
  if (!isGymId(body.gymId)) return fail('Invalid gym.');
  const type = IMAGE_TYPES.find(t => t === body.contentType);
  if (!type) return fail('Images must be JPEG, PNG or WebP.');
  const base64 = body.data;
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return fail('Invalid image data.');
  if (Math.floor((base64.length * 3) / 4) > MAX_IMAGE_BYTES) return fail('Image is too large (3 MB max).');
  const alt = text(body.alt, 160);
  if (!alt.ok) return fail(`Description: ${alt.error}`);
  return { ok: true, value: { gymId: body.gymId, contentType: type, base64, alt: alt.value } };
}
