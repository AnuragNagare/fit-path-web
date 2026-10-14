/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers read untyped JSON responses */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from './_lib/http.js';

// Real database, fake sign-in and fake map lookup. Test rows use this gym id and these user ids only.
const GYM = 'node-990000001';
const ADMIN = 'test_admin';
const ALICE = 'test_alice';
const BOB = 'test_bob';

const state = vi.hoisted(() => ({ user: 'test_alice' }));
const PROFILES: Record<string, { name: string; email: string; emailVerified: boolean }> = {
  test_admin: { name: 'Admin Person', email: 'owner@fitpath.test', emailVerified: true },
  test_alice: { name: 'Alice Rao', email: 'alice@fitpath.test', emailVerified: true },
  test_bob: { name: 'Bob Das', email: 'bob@fitpath.test', emailVerified: true },
};

vi.mock('./_lib/auth.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./_lib/auth.js')>()),
  authUser: async () => state.user,
  getClerkProfile: async (id: string) => PROFILES[id],
}));
vi.mock('./_lib/geo.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./_lib/geo.js')>()),
  getGymById: async (id: string) =>
    id === GYM
      ? { id: GYM, name: 'Test Gym', lat: 19, lon: 72, address: 'Map street', area: 'Bandra', distanceKm: 0, hours: null, openNow: null, phone: null, website: null, features: ['pool'] }
      : null,
}));

const { rows } = await import('./_lib/db.js');
const { clearAdminCache } = await import('./_lib/admin.js');
const { default: bookings } = await import('./bookings.js');
const { default: reviews } = await import('./reviews.js');
const { default: admin } = await import('./admin.js');
const { default: image } = await import('./image.js');
const { enrichGyms } = await import('./_lib/gym-data.js');
const { endDateFor, todayIST } = await import('./_lib/plans.js');

type Out = { status: number; body: any; headers: Record<string, string> };
async function call(handler: (q: ApiRequest, r: ApiResponse) => Promise<unknown>, user: string, method: string, query: Record<string, string> = {}, body?: unknown): Promise<Out> {
  state.user = user;
  const out: Out = { status: 200, body: null, headers: {} };
  const res: ApiResponse = {
    status(code) { out.status = code; return res; },
    setHeader(name, value) { out.headers[name] = value; },
    json(b) { out.body = b; },
    send(b) { out.body = b; },
  };
  await handler({ method, headers: {}, query, body }, res);
  return out;
}

async function cleanup() {
  await rows('DELETE FROM reviews WHERE gym_id = $1', [GYM]);
  await rows('DELETE FROM bookings WHERE gym_id = $1', [GYM]);
  await rows('DELETE FROM gym_images WHERE gym_id = $1', [GYM]);
  await rows('DELETE FROM gym_overrides WHERE gym_id = $1', [GYM]);
}

describe('bookings, reviews and admin against the real database', () => {
  beforeAll(async () => {
    process.env.ADMIN_EMAILS = 'owner@fitpath.test';
    clearAdminCache();
    await cleanup();
  });
  afterAll(cleanup);

  it('non-admins are refused by every admin resource', async () => {
    for (const resource of ['me', 'stats', 'bookings', 'gyms', 'images', 'reviews']) {
      const r = await call(admin, ALICE, 'GET', { resource });
      expect(r.status, resource).toBe(403);
    }
    expect((await call(admin, ADMIN, 'GET', { resource: 'me' })).body).toEqual({ admin: true });
  });

  it('a gym with no real price cannot be booked', async () => {
    const r = await call(bookings, ALICE, 'POST', {}, { gymId: GYM, plan: 'month', people: 1 });
    expect(r.status).toBe(409);
  });

  it('admin edits a gym: details, prices, then it shows up in search data', async () => {
    const put = await call(admin, ADMIN, 'PUT', { resource: 'gyms', id: GYM }, {
      name: 'Iron Temple', description: 'Strength floor', features: ['sauna'], prices: { month: 1500, day: 200 }, hidden: false,
    });
    expect(put.status).toBe(200);
    const read = await call(admin, ADMIN, 'GET', { resource: 'gyms', id: GYM });
    expect(read.body.override.name).toBe('Iron Temple');
    expect(read.body.osm.name).toBe('Test Gym');

    const [gym] = await enrichGyms([read.body.osm]);
    expect(gym).toMatchObject({ name: 'Iron Temple', features: ['sauna'], description: 'Strength floor', bookable: ['day', 'month'] });
    expect(gym.prices.month).toBe(1500);
  });

  it('rejects invalid admin input', async () => {
    expect((await call(admin, ADMIN, 'PUT', { resource: 'gyms', id: GYM }, { website: 'javascript:alert(1)' })).status).toBe(400);
    expect((await call(admin, ADMIN, 'PUT', { resource: 'gyms', id: 'bad id' }, {})).status).toBe(400);
  });

  let bookingId = '';
  it('a user books: dates and amount are set by the server', async () => {
    const r = await call(bookings, ALICE, 'POST', {}, { gymId: GYM, plan: 'month', people: 2, amount: 1, startDate: '2020-01-01' });
    expect(r.status).toBe(201);
    const b = r.body.booking;
    bookingId = b.id;
    expect(b).toMatchObject({ gymName: 'Iron Temple', plan: 'month', people: 2, amountInr: 3000, status: 'booked', paymentStatus: 'due' });
    expect(b.startDate).toBe(todayIST());
    expect(b.endDate).toBe(endDateFor('month', todayIST()));
    expect(b.userEmail).toBeUndefined(); // users never get email fields back
  });

  it('the same user cannot double-book a gym, and a plan without a price is refused', async () => {
    expect((await call(bookings, ALICE, 'POST', {}, { gymId: GYM, plan: 'day', people: 1 })).status).toBe(409);
    expect((await call(bookings, BOB, 'POST', {}, { gymId: GYM, plan: 'year', people: 1 })).status).toBe(409);
  });

  it('users only see their own bookings and cannot cancel someone else\'s', async () => {
    expect((await call(bookings, ALICE, 'GET')).body.bookings.map((b: any) => b.id)).toContain(bookingId);
    expect((await call(bookings, BOB, 'GET')).body.bookings).toEqual([]);
    expect((await call(bookings, BOB, 'PATCH', {}, { id: bookingId })).status).toBe(404);
  });

  it('only someone with a booking can review, once per gym', async () => {
    expect((await call(reviews, BOB, 'POST', {}, { gymId: GYM, rating: 5 })).status).toBe(403);
    expect((await call(reviews, ALICE, 'POST', {}, { gymId: GYM, rating: 4, body: 'Solid gym' })).status).toBe(200);
    expect((await call(reviews, ALICE, 'POST', {}, { gymId: GYM, rating: 5, body: 'Even better' })).status).toBe(200);

    const alice = await call(reviews, ALICE, 'GET', { gymId: GYM });
    expect(alice.body.reviews).toHaveLength(1);
    expect(alice.body.reviews[0]).toMatchObject({ userName: 'Alice', rating: 5, mine: true });
    expect(alice.body.summary).toEqual({ rating: 5, reviewCount: 1 });
    expect(alice.body.canReview).toBe(true);

    const bob = await call(reviews, BOB, 'GET', { gymId: GYM });
    expect(bob.body.canReview).toBe(false);
    expect(bob.body.reviews[0].mine).toBe(false);
    expect(JSON.stringify(bob.body)).not.toContain('alice@fitpath.test');

    const [gym] = await enrichGyms([(await call(admin, ADMIN, 'GET', { resource: 'gyms', id: GYM })).body.osm]);
    expect(gym).toMatchObject({ rating: 5, reviewCount: 1 });
  });

  it('admin sees who booked what, can filter, and mark payment', async () => {
    const list = await call(admin, ADMIN, 'GET', { resource: 'bookings', gym: 'iron' });
    const mine = list.body.bookings.find((b: any) => b.id === bookingId);
    expect(mine).toMatchObject({ userName: 'Alice Rao', userEmail: 'alice@fitpath.test', gymName: 'Iron Temple', amountInr: 3000 });
    expect((await call(admin, ADMIN, 'GET', { resource: 'bookings', q: 'alice@fitpath' })).body.total).toBeGreaterThanOrEqual(1);
    expect((await call(admin, ADMIN, 'GET', { resource: 'bookings', q: 'nobody-matches-this' })).body.total).toBe(0);
    expect((await call(admin, ADMIN, 'GET', { resource: 'bookings', q: '%' })).body.total).toBe(0); // wildcard is escaped

    const paid = await call(admin, ADMIN, 'PATCH', { resource: 'bookings' }, { id: bookingId, paymentStatus: 'paid' });
    expect(paid.body.booking.paymentStatus).toBe('paid');

    const stats = await call(admin, ADMIN, 'GET', { resource: 'stats' });
    expect(stats.body.bookings.total).toBeGreaterThanOrEqual(1);
    expect(stats.body.amountPaidInr).toBeGreaterThanOrEqual(3000);
  });

  it('admin edits a review and hides it; the gym rating updates', async () => {
    const list = await call(admin, ADMIN, 'GET', { resource: 'reviews', gym: 'iron' });
    const review = list.body.reviews.find((r: any) => r.userEmail === 'alice@fitpath.test');
    expect(review).toBeDefined();

    const edited = await call(admin, ADMIN, 'PATCH', { resource: 'reviews' }, { id: review.id, body: 'Edited by admin' });
    expect(edited.body.review).toMatchObject({ body: 'Edited by admin', editedByAdmin: true });

    await call(admin, ADMIN, 'PATCH', { resource: 'reviews' }, { id: review.id, hidden: true });
    expect((await call(reviews, BOB, 'GET', { gymId: GYM })).body.reviews).toEqual([]);
    const [gym] = await enrichGyms([(await call(admin, ADMIN, 'GET', { resource: 'gyms', id: GYM })).body.osm]);
    expect(gym).toMatchObject({ rating: null, reviewCount: 0 });
  });

  it('images: upload, serve, reorder, delete, with limits', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const one = await call(admin, ADMIN, 'POST', { resource: 'images' }, { gymId: GYM, contentType: 'image/png', data: png, alt: 'Reception' });
    const two = await call(admin, ADMIN, 'POST', { resource: 'images' }, { gymId: GYM, contentType: 'image/png', data: png });
    expect([one.status, two.status]).toEqual([201, 201]);

    const served = await call(image, ALICE, 'GET', { id: one.body.image.id });
    expect(served.status).toBe(200);
    expect(served.headers['Content-Type']).toBe('image/png');
    expect(Buffer.isBuffer(served.body) && served.body.subarray(1, 4).toString()).toBe('PNG');

    await call(admin, ADMIN, 'PATCH', { resource: 'images' }, { id: one.body.image.id, move: 'down' });
    const [gym] = await enrichGyms([(await call(admin, ADMIN, 'GET', { resource: 'gyms', id: GYM })).body.osm]);
    expect(gym.images.map(i => i.id)).toEqual([two.body.image.id, one.body.image.id]);

    expect((await call(admin, ADMIN, 'POST', { resource: 'images' }, { gymId: GYM, contentType: 'image/gif', data: png })).status).toBe(400);
    expect((await call(image, ALICE, 'GET', { id: 'not-a-uuid' })).status).toBe(400);

    expect((await call(admin, ADMIN, 'DELETE', { resource: 'images', id: one.body.image.id })).status).toBe(200);
    expect((await call(image, ALICE, 'GET', { id: one.body.image.id })).status).toBe(404);
  });

  it('a hidden gym disappears from search data; resetting brings the map data back', async () => {
    await call(admin, ADMIN, 'PUT', { resource: 'gyms', id: GYM }, { name: 'Iron Temple', hidden: true });
    const osm = (await call(admin, ADMIN, 'GET', { resource: 'gyms', id: GYM })).body.osm;
    expect(await enrichGyms([osm])).toEqual([]);

    await call(admin, ADMIN, 'DELETE', { resource: 'gyms', id: GYM });
    const [gym] = await enrichGyms([osm]);
    expect(gym).toMatchObject({ name: 'Test Gym', bookable: [] });
  });

  it('a user cancels their own booking once; then it cannot be cancelled again', async () => {
    const first = await call(bookings, ALICE, 'PATCH', {}, { id: bookingId });
    expect(first.body.booking.status).toBe('cancelled');
    expect((await call(bookings, ALICE, 'PATCH', {}, { id: bookingId })).status).toBe(409);
    expect((await call(admin, ADMIN, 'GET', { resource: 'bookings', status: 'cancelled' })).body.bookings.some((b: any) => b.id === bookingId)).toBe(true);
  });
});
