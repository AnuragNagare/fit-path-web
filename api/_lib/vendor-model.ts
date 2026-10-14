import { PLANS, type PartialPlanPrices } from './plans.js';
import { text, type Parsed } from './validate.js';

// What a gym owner edits. `live` is what the public sees; `draft` is the owner's working copy.
export type VendorProfile = {
  name: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  description: string | null;
  features: string[];
  prices: PartialPlanPrices;
};

export const emptyProfile = (): VendorProfile => ({
  name: null, address: null, lat: null, lon: null, phone: null, website: null, hours: null, description: null, features: [], prices: {},
});

// Fills missing fields so older or partial JSON from the database is always a complete profile.
export function normalizeProfile(raw: unknown): VendorProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const prices: PartialPlanPrices = {};
  const rp = (r.prices && typeof r.prices === 'object' ? r.prices : {}) as Record<string, unknown>;
  for (const plan of PLANS) if (typeof rp[plan] === 'number') prices[plan] = rp[plan] as number;
  return {
    name: str(r.name), address: str(r.address), lat: num(r.lat), lon: num(r.lon), phone: str(r.phone), website: str(r.website),
    hours: str(r.hours), description: str(r.description),
    features: Array.isArray(r.features) ? r.features.filter((f): f is string => typeof f === 'string') : [],
    prices,
  };
}

// India's bounding box, the same area the address lookup is limited to.
const IN_BOUNDS = { south: 6.5, north: 37.5, west: 68, east: 97.5 };

export function parseVendorProfile(body: Record<string, unknown>): Parsed<VendorProfile> {
  const fields = { name: 120, address: 240, phone: 40, website: 300, hours: 200, description: 2000 } as const;
  const out: Record<string, string | null> = {};
  for (const [key, max] of Object.entries(fields)) {
    const parsed = text(body[key], max);
    if (!parsed.ok) return { ok: false, error: `${key}: ${parsed.error}` };
    out[key] = parsed.value;
  }
  if (out.website && !/^https?:\/\/\S+$/i.test(out.website)) return { ok: false, error: 'Website must start with http:// or https://.' };

  let lat: number | null = null;
  let lon: number | null = null;
  if (body.lat !== undefined && body.lat !== null) {
    if (typeof body.lat !== 'number' || typeof body.lon !== 'number' || !Number.isFinite(body.lat) || !Number.isFinite(body.lon)) {
      return { ok: false, error: 'Invalid location.' };
    }
    if (body.lat < IN_BOUNDS.south || body.lat > IN_BOUNDS.north || body.lon < IN_BOUNDS.west || body.lon > IN_BOUNDS.east) {
      return { ok: false, error: 'The location must be in India.' };
    }
    lat = body.lat;
    lon = body.lon;
  }

  let features: string[] = [];
  if (body.features !== undefined && body.features !== null) {
    const list = body.features;
    if (!Array.isArray(list) || list.length > 60 || !list.every(f => typeof f === 'string' && /^[a-z0-9_]{1,40}$/.test(f))) {
      return { ok: false, error: 'Invalid features.' };
    }
    features = Array.from(new Set(list as string[]));
  }

  const prices: PartialPlanPrices = {};
  const rawPrices = body.prices;
  if (rawPrices !== undefined && rawPrices !== null) {
    if (typeof rawPrices !== 'object' || Array.isArray(rawPrices)) return { ok: false, error: 'Invalid prices.' };
    for (const plan of PLANS) {
      const v = (rawPrices as Record<string, unknown>)[plan];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 1_000_000) {
        return { ok: false, error: `${plan} price must be a whole number of rupees between 1 and 1,000,000.` };
      }
      prices[plan] = v;
    }
  }

  return {
    ok: true,
    value: { name: out.name, address: out.address, lat, lon, phone: out.phone, website: out.website, hours: out.hours, description: out.description, features, prices },
  };
}

// What the owner must fill in before a gym can be submitted.
export function submitProblems(profile: VendorProfile, photoCount: number): string[] {
  const problems: string[] = [];
  if (!profile.name) problems.push('Add the gym name.');
  if (!profile.address || profile.lat === null || profile.lon === null) problems.push('Add the address and confirm its location on the map.');
  if (photoCount < 1) problems.push('Upload at least one photo.');
  return problems;
}

const CHANGE_LABELS: Record<string, string> = {
  name: 'Name', address: 'Address', lat: 'Location', lon: 'Location', phone: 'Phone', website: 'Website', hours: 'Opening hours',
  description: 'Description', features: 'Features', prices: 'Prices',
};

// Which parts of the profile differ, for the admin's side-by-side view.
export function changedFields(live: VendorProfile | null, draft: VendorProfile): string[] {
  const base = live ?? emptyProfile();
  const labels = new Set<string>();
  for (const key of Object.keys(CHANGE_LABELS) as (keyof VendorProfile)[]) {
    if (JSON.stringify(base[key]) !== JSON.stringify(draft[key])) labels.add(CHANGE_LABELS[key]);
  }
  return Array.from(labels);
}

// ── Status ──

export type VendorStatus = 'new' | 'pending' | 'live' | 'suspended';

// What the owner (and admin) sees, derived from the stored status and submission.
export type VendorState = 'draft' | 'changes_requested' | 'waiting' | 'live' | 'live_pending' | 'suspended';

export function deriveState(g: { status: VendorStatus; draft_submitted_at: unknown; review_note: string | null }): VendorState {
  if (g.status === 'suspended') return 'suspended';
  if (g.status === 'pending') return 'waiting';
  if (g.status === 'live') return g.draft_submitted_at ? 'live_pending' : g.review_note ? 'changes_requested' : 'live';
  return g.review_note ? 'changes_requested' : 'draft';
}

// ── Media ──

export const MAX_PHOTOS = 10;
export const MAX_VIDEOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export type MediaKind = 'photo' | 'video';
export const isMediaKind = (v: unknown): v is MediaKind => v === 'photo' || v === 'video';
export const typesFor = (kind: MediaKind) => (kind === 'photo' ? PHOTO_TYPES : VIDEO_TYPES);
export const maxBytesFor = (kind: MediaKind) => (kind === 'photo' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES);
export const maxCountFor = (kind: MediaKind) => (kind === 'photo' ? MAX_PHOTOS : MAX_VIDEOS);

// Only files in our own Vercel Blob store can be registered as a gym's media.
export function isBlobUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export type MediaInput = { kind: MediaKind; url: string; alt: string | null };

export function parseMediaInput(body: Record<string, unknown>): Parsed<MediaInput> {
  if (!isMediaKind(body.kind)) return { ok: false, error: 'Choose photo or video.' };
  if (!isBlobUrl(body.url)) return { ok: false, error: 'Invalid file address.' };
  const alt = text(body.alt, 160);
  if (!alt.ok) return { ok: false, error: `Description: ${alt.error}` };
  return { ok: true, value: { kind: body.kind, url: body.url, alt: alt.value } };
}

// A path the owner may upload to: vendor/<their gym id>/<file name>.
export function uploadPathOk(pathname: string, gymId: string): boolean {
  return pathname.startsWith(`vendor/${gymId}/`) && !pathname.includes('..') && pathname.length <= 200;
}
