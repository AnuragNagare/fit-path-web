import { describe, expect, it } from 'vitest';
import { hashToken, inviteExpiry, inviteStatus, INVITE_DAYS, isToken, newToken } from './invites.js';
import {
  changedFields, deriveState, emptyProfile, isBlobUrl, normalizeProfile, parseMediaInput, parseVendorProfile, submitProblems, uploadPathOk,
  type VendorProfile,
} from './vendor-model.js';
import { isGymId, isOsmGymId, isVendorGymId } from './validate.js';

const GYM = 'vendor-3f2b8c1e-5a4d-4e6f-9b0a-1c2d3e4f5a6b';
const BLOB = `https://abc123.public.blob.vercel-storage.com/vendor/${GYM}/front-xyz.jpg`;

describe('invite tokens', () => {
  it('are random, url-safe and long enough to be unguessable', () => {
    const a = newToken();
    expect(isToken(a)).toBe(true);
    expect(a).not.toBe(newToken());
    expect(a.length).toBe(43);
  });

  it('are stored only as a hash that cannot be turned back into the token', () => {
    const t = newToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).not.toBe(hashToken(newToken()));
  });

  it('rejects anything that is not a token', () => {
    for (const bad of ['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}!`, null, 5]) expect(isToken(bad)).toBe(false);
  });

  it('expire after the set number of days', () => {
    const now = new Date('2026-10-14T00:00:00Z');
    expect(inviteExpiry(now).toISOString()).toBe('2026-10-28T00:00:00.000Z');
    expect(INVITE_DAYS).toBe(14);
  });

  it('status: cancelled beats used beats expired', () => {
    const now = new Date('2026-10-14T00:00:00Z');
    const base = { used_at: null, revoked_at: null, expires_at: '2026-10-20T00:00:00Z' };
    expect(inviteStatus(base, now)).toBe('valid');
    expect(inviteStatus({ ...base, expires_at: '2026-10-13T00:00:00Z' }, now)).toBe('expired');
    expect(inviteStatus({ ...base, expires_at: '2026-10-14T00:00:00Z' }, now)).toBe('expired');
    expect(inviteStatus({ ...base, used_at: '2026-10-10T00:00:00Z' }, now)).toBe('used');
    expect(inviteStatus({ ...base, used_at: '2026-10-10T00:00:00Z', revoked_at: '2026-10-11T00:00:00Z' }, now)).toBe('cancelled');
  });
});

describe('gym ids', () => {
  it('map ids and registered ids are both gym ids, kept apart', () => {
    expect(isGymId('node-1')).toBe(true);
    expect(isGymId(GYM)).toBe(true);
    expect(isOsmGymId(GYM)).toBe(false);
    expect(isVendorGymId('node-1')).toBe(false);
    expect(isVendorGymId(GYM)).toBe(true);
    expect(isGymId('vendor-1; DROP TABLE x')).toBe(false);
    expect(isGymId('vendor-not-a-uuid')).toBe(false);
  });
});

describe('parseVendorProfile', () => {
  const ok = { name: ' Iron Temple ', address: '12 MG Road, Pune', lat: 18.52, lon: 73.85, phone: '', website: 'https://iron.example', features: ['pool', 'pool', 'sauna'], prices: { month: 1500, day: null, week: '' } };

  it('trims, drops empties and removes duplicate features', () => {
    const r = parseVendorProfile(ok);
    expect(r.ok && r.value).toMatchObject({ name: 'Iron Temple', phone: null, lat: 18.52, features: ['pool', 'sauna'], prices: { month: 1500 } });
  });

  it('rejects locations outside India and half locations', () => {
    expect(parseVendorProfile({ ...ok, lat: 51.5, lon: -0.12 }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, lat: 18.5, lon: undefined }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, lat: 'x', lon: 'y' }).ok).toBe(false);
  });

  it('rejects bad websites, prices, features and long text', () => {
    expect(parseVendorProfile({ ...ok, website: 'javascript:alert(1)' }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, prices: { month: 0 } }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, prices: { day: 1.5 } }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, prices: { year: 5_000_000 } }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, features: ['Bad Id'] }).ok).toBe(false);
    expect(parseVendorProfile({ ...ok, description: 'x'.repeat(2001) }).ok).toBe(false);
  });

  it('an empty form is a valid (empty) draft', () => {
    expect(parseVendorProfile({}).ok).toBe(true);
  });
});

describe('submit rules', () => {
  const full: VendorProfile = { ...emptyProfile(), name: 'Iron Temple', address: '12 MG Road', lat: 18.5, lon: 73.8 };

  it('needs a name, a confirmed location and one photo', () => {
    expect(submitProblems(emptyProfile(), 0)).toHaveLength(3);
    expect(submitProblems({ ...full, lat: null }, 1)).toEqual(['Add the address and confirm its location on the map.']);
    expect(submitProblems(full, 0)).toEqual(['Upload at least one photo.']);
    expect(submitProblems(full, 1)).toEqual([]);
  });
});

describe('changes between live and draft', () => {
  const live: VendorProfile = { ...emptyProfile(), name: 'Iron', address: 'A', lat: 1, lon: 2, prices: { month: 1000 } };

  it('lists only what differs, with each label once', () => {
    expect(changedFields(live, live)).toEqual([]);
    expect(changedFields(live, { ...live, name: 'Iron Temple', prices: { month: 1200 } })).toEqual(['Name', 'Prices']);
    expect(changedFields(live, { ...live, lat: 3, lon: 4 })).toEqual(['Location']);
  });

  it('a first submission has every filled field as a change', () => {
    expect(changedFields(null, live)).toEqual(['Name', 'Address', 'Location', 'Prices']);
  });
});

describe('status shown to owner and admin', () => {
  const g = (status: 'new' | 'pending' | 'live' | 'suspended', submitted: boolean, note: string | null = null) => ({ status, draft_submitted_at: submitted ? 'x' : null, review_note: note });

  it('covers every case', () => {
    expect(deriveState(g('new', false))).toBe('draft');
    expect(deriveState(g('new', false, 'Add a clearer photo'))).toBe('changes_requested');
    expect(deriveState(g('pending', true))).toBe('waiting');
    expect(deriveState(g('live', false))).toBe('live');
    expect(deriveState(g('live', true))).toBe('live_pending');
    expect(deriveState(g('live', false, 'Price too high'))).toBe('changes_requested');
    expect(deriveState(g('suspended', true))).toBe('suspended');
  });

  it('normalizeProfile completes partial or damaged data', () => {
    expect(normalizeProfile(null)).toEqual(emptyProfile());
    expect(normalizeProfile({ name: 'X', prices: { month: 5, junk: 9 }, features: ['a', 3] })).toMatchObject({ name: 'X', prices: { month: 5 }, features: ['a'] });
  });
});

describe('media rules', () => {
  it('only files in our Blob store, in the owner folder, can be registered', () => {
    expect(isBlobUrl(BLOB)).toBe(true);
    expect(isBlobUrl('http://abc.public.blob.vercel-storage.com/x.jpg')).toBe(false);
    expect(isBlobUrl('https://evil.example/x.jpg')).toBe(false);
    expect(isBlobUrl('https://public.blob.vercel-storage.com.evil.example/x.jpg')).toBe(false);
    expect(isBlobUrl('javascript:alert(1)')).toBe(false);
    expect(uploadPathOk(`vendor/${GYM}/a.jpg`, GYM)).toBe(true);
    expect(uploadPathOk(`vendor/${GYM}/../other/a.jpg`, GYM)).toBe(false);
    expect(uploadPathOk('vendor/vendor-other/a.jpg', GYM)).toBe(false);
  });

  it('parseMediaInput checks kind, address and description length', () => {
    expect(parseMediaInput({ kind: 'photo', url: BLOB, alt: ' Front ' })).toEqual({ ok: true, value: { kind: 'photo', url: BLOB, alt: 'Front' } });
    expect(parseMediaInput({ kind: 'audio', url: BLOB }).ok).toBe(false);
    expect(parseMediaInput({ kind: 'video', url: 'https://evil.example/v.mp4' }).ok).toBe(false);
    expect(parseMediaInput({ kind: 'photo', url: BLOB, alt: 'x'.repeat(161) }).ok).toBe(false);
  });
});
