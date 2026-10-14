import { describe, expect, it } from 'vitest';
import { isAdminProfile, parseAdminEmails } from './admin.js';
import { profileFromUser } from './auth.js';
import { canCancel } from './booking-model.js';
import { applyMeta, emptyMeta, ratingStats, type GymOverrideRow } from './gym-data.js';
import type { ApiGym } from './geo.js';

describe('admin check', () => {
  const admins = parseAdminEmails(' Owner@Example.com , second@example.com ,, ');

  it('parses a comma-separated list, case-insensitively', () => {
    expect([...admins]).toEqual(['owner@example.com', 'second@example.com']);
    expect(parseAdminEmails(undefined).size).toBe(0);
  });

  it('requires a verified email on the list', () => {
    expect(isAdminProfile({ email: 'OWNER@example.com', emailVerified: true }, admins)).toBe(true);
    expect(isAdminProfile({ email: 'owner@example.com', emailVerified: false }, admins)).toBe(false);
    expect(isAdminProfile({ email: 'someone@example.com', emailVerified: true }, admins)).toBe(false);
  });

  it('nobody is admin when ADMIN_EMAILS is empty', () => {
    expect(isAdminProfile({ email: 'owner@example.com', emailVerified: true }, parseAdminEmails(''))).toBe(false);
  });
});

describe('profileFromUser', () => {
  const email = (id: string, address: string, status = 'verified') => ({ id, emailAddress: address, verification: { status } });

  it('uses the primary email and the full name', () => {
    const p = profileFromUser({ firstName: 'Asha', lastName: 'Rao', username: null, primaryEmailAddressId: 'b', emailAddresses: [email('a', 'old@x.com'), email('b', 'asha@x.com')] });
    expect(p).toEqual({ name: 'Asha Rao', email: 'asha@x.com', emailVerified: true });
  });

  it('falls back to the username, then the email name, and reports unverified emails', () => {
    expect(profileFromUser({ firstName: null, lastName: null, username: 'ashar', primaryEmailAddressId: 'a', emailAddresses: [email('a', 'a@x.com', 'unverified')] })).toEqual({ name: 'ashar', email: 'a@x.com', emailVerified: false });
    expect(profileFromUser({ firstName: null, lastName: null, username: null, primaryEmailAddressId: 'a', emailAddresses: [email('a', 'zed@x.com')] }).name).toBe('zed');
  });
});

describe('canCancel', () => {
  it('only an active, unfinished booking can be cancelled', () => {
    expect(canCancel({ status: 'booked', end_date: '2026-10-20' }, '2026-10-14')).toBe(true);
    expect(canCancel({ status: 'booked', end_date: '2026-10-14' }, '2026-10-14')).toBe(true);
    expect(canCancel({ status: 'booked', end_date: '2026-10-13' }, '2026-10-14')).toBe(false);
    expect(canCancel({ status: 'cancelled', end_date: '2026-10-20' }, '2026-10-14')).toBe(false);
  });
});

describe('gym merge', () => {
  const gym: ApiGym = {
    id: 'node-1', name: 'Map Gym', lat: 1, lon: 2, address: 'Map street', area: 'Bandra', distanceKm: 1.2,
    hours: '06:00-22:00', openNow: true, phone: '111', website: null, features: ['pool'],
  };
  const override = (o: Partial<GymOverrideRow>): GymOverrideRow => ({
    gym_id: 'node-1', name: null, address: null, phone: null, website: null, hours: null, description: null, features: null, prices: {}, hidden: false, ...o,
  });

  it('without edits keeps the map data and uses sample prices that cannot be booked', () => {
    const merged = applyMeta(gym, emptyMeta());
    expect(merged?.name).toBe('Map Gym');
    expect(merged?.features).toEqual(['pool']);
    expect(merged?.bookable).toEqual([]);
    expect(merged?.rating).toBeNull();
    expect(merged?.reviewCount).toBe(0);
  });

  it('admin edits win, empty fields fall back to the map', () => {
    const merged = applyMeta(gym, { ...emptyMeta(), override: override({ name: 'Iron Gym', phone: '999', features: ['sauna'], description: 'Strength floor', prices: { month: 1700 } }) });
    expect(merged).toMatchObject({ name: 'Iron Gym', phone: '999', address: 'Map street', features: ['sauna'], description: 'Strength floor' });
    expect(merged?.prices.month).toBe(1700);
    expect(merged?.bookable).toEqual(['month']);
  });

  it('hidden gyms are dropped', () => {
    expect(applyMeta(gym, { ...emptyMeta(), override: override({ hidden: true }) })).toBeNull();
  });

  it('rating is the average to one decimal, or null with no reviews', () => {
    expect(ratingStats(14, 3)).toEqual({ rating: 4.7, reviewCount: 3 });
    expect(ratingStats(0, 0)).toEqual({ rating: null, reviewCount: 0 });
  });
});
