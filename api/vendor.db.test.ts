/* eslint-disable @typescript-eslint/no-explicit-any -- test helpers read untyped JSON responses */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from './_lib/http.js';

// Real database; fake sign-in, fake Blob store, fake map search. Test rows use these ids and labels only.
const ADMIN = 'test_vadmin';
const OWNER = 'test_vowner1';
const OWNER2 = 'test_vowner2';
const CUSTOMER = 'test_vcustomer';
const LABEL = 'TEST invite';
const JAIPUR = { lat: 26.9124, lon: 75.7873 };
const DELHI = { lat: 28.6139, lon: 77.209 };

const state = vi.hoisted(() => ({ user: 'test_vowner1', blobs: new Map<string, { size: number; contentType: string }>(), deleted: [] as string[] }));
const PROFILES: Record<string, { name: string; email: string; emailVerified: boolean }> = {
  test_vadmin: { name: 'Admin Person', email: 'owner@fitpath.test', emailVerified: true },
  test_vowner1: { name: 'Priya Sharma', email: 'priya@gym.test', emailVerified: true },
  test_vowner2: { name: 'Raj Mehta', email: 'raj@gym.test', emailVerified: true },
  test_vcustomer: { name: 'Carol Customer', email: 'carol-secret@fitpath.test', emailVerified: true },
};

vi.mock('./_lib/auth.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./_lib/auth.js')>()),
  authUser: async () => state.user,
  requireUser: async () => true,
  getClerkProfile: async (id: string) => PROFILES[id],
  userIdFromToken: async (token: string) => (token.startsWith('tok_') ? token.slice(4) : null),
}));
vi.mock('./_lib/geo.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./_lib/geo.js')>()),
  findGymsNearby: async () => [],
  getGymById: async () => null,
}));
vi.mock('./_lib/blob.js', () => ({
  blobInfo: async (url: string) => state.blobs.get(url) ?? null,
  deleteBlobs: async (urls: string[]) => { state.deleted.push(...urls); },
}));
vi.mock('@vercel/blob/client', () => ({
  handleUpload: async ({ body, onBeforeGenerateToken }: any) => onBeforeGenerateToken(body.pathname, body.clientPayload, false),
}));

const { rows } = await import('./_lib/db.js');
const { clearAdminCache } = await import('./_lib/admin.js');
const { default: vendor } = await import('./vendor.js');
const { default: admin } = await import('./admin.js');
const { default: gyms } = await import('./gyms.js');
const { default: gym } = await import('./gym.js');
const { default: bookings } = await import('./bookings.js');
const { default: reviews } = await import('./reviews.js');
const { hashToken } = await import('./_lib/invites.js');

type Out = { status: number; body: any };
async function call(handler: (q: ApiRequest, r: ApiResponse) => Promise<unknown>, user: string, method: string, query: Record<string, string> = {}, body?: unknown): Promise<Out> {
  state.user = user;
  const out: Out = { status: 200, body: null };
  const res: ApiResponse = {
    status(code) { out.status = code; return res; },
    setHeader() {},
    json(b) { out.body = b; },
    send(b) { out.body = b; },
  };
  await handler({ method, headers: {}, query, body }, res);
  return out;
}
const v = (resource: string, user = OWNER, method = 'GET', query: Record<string, string> = {}, body?: unknown) => call(vendor, user, method, { resource, ...query }, body);
const a = (resource: string, method = 'GET', query: Record<string, string> = {}, body?: unknown) => call(admin, ADMIN, method, { resource, ...query }, body);
const decide = (id: string, action: string, note?: string) => a('registrations', 'PATCH', {}, { id, action, note });

async function cleanup() {
  const owned = await rows<{ id: string }>("SELECT id FROM vendor_gyms WHERE owner_clerk_id LIKE 'test_v%'");
  const ids = owned.map(g => g.id);
  if (ids.length) {
    await rows('DELETE FROM reviews WHERE gym_id = ANY($1::text[])', [ids]);
    await rows('DELETE FROM bookings WHERE gym_id = ANY($1::text[])', [ids]);
  }
  await rows("DELETE FROM vendor_gyms WHERE owner_clerk_id LIKE 'test_v%'");
  await rows("DELETE FROM vendor_invites WHERE created_by = 'test_vadmin'");
}

const blob = (gymId: string, name: string, contentType = 'image/jpeg', size = 200_000) => {
  const url = `https://store1.public.blob.vercel-storage.com/vendor/${gymId}/${name}`;
  state.blobs.set(url, { size, contentType });
  return url;
};

const profile = (extra: Record<string, unknown> = {}) => ({
  name: 'Iron Temple', address: '12 MG Road, Jaipur', ...JAIPUR, phone: '99999', website: 'https://iron.example', hours: '6am to 10pm',
  description: 'Strength floor', features: ['pool', 'sauna'], prices: { month: 1500, day: 200 }, ...extra,
});

async function newInvite(): Promise<string> {
  const r = await a('invites', 'POST', {}, { label: LABEL });
  expect(r.status).toBe(201);
  return r.body.token;
}

describe('gym owner registration, approval and public listing (real database)', () => {
  beforeAll(async () => {
    process.env.ADMIN_EMAILS = 'owner@fitpath.test';
    clearAdminCache();
    await cleanup();
  });
  afterAll(cleanup);

  let token = '';
  let gymId = '';
  let photo1 = '';

  it('only admins can use the invite and registration tools', async () => {
    for (const resource of ['invites', 'registrations']) expect((await call(admin, OWNER, 'GET', { resource })).status).toBe(403);
    expect((await call(admin, OWNER, 'POST', { resource: 'invites' }, { label: 'x' })).status).toBe(403);
  });

  it('creating an invite needs a label, and the token is never stored', async () => {
    expect((await a('invites', 'POST', {}, {})).status).toBe(400);
    token = await newInvite();
    const dump = JSON.stringify(await rows('SELECT * FROM vendor_invites WHERE created_by = $1', [ADMIN]));
    expect(dump).not.toContain(token);
    expect(dump).toContain(hashToken(token));
  });

  it('a visitor can check a link without signing in', async () => {
    const ok = await call(vendor, 'nobody', 'GET', { resource: 'invite', token });
    expect(ok.body).toEqual({ status: 'valid', label: LABEL });
    expect((await call(vendor, 'nobody', 'GET', { resource: 'invite', token: 'x'.repeat(43) })).body.status).toBe('unknown');
    expect((await call(vendor, 'nobody', 'GET', { resource: 'invite', token: 'junk' })).body.status).toBe('unknown');
  });

  it('claiming creates the gym once; the link is then used up', async () => {
    const claimed = await v('claim', OWNER, 'POST', {}, { token });
    expect(claimed.status).toBe(201);
    gymId = claimed.body.gym.id;
    expect(gymId).toMatch(/^vendor-/);
    expect(claimed.body.gym.state).toBe('draft');

    const again = await v('claim', OWNER2, 'POST', {}, { token });
    expect(again.status).toBe(410);
    expect(again.body.error).toMatch(/already been used/);
    expect((await call(vendor, 'nobody', 'GET', { resource: 'invite', token })).body.status).toBe('used');
  });

  it('one gym per account, and bad, cancelled and expired links are refused', async () => {
    const second = await newInvite();
    expect((await v('claim', OWNER, 'POST', {}, { token: second })).status).toBe(409);
    expect((await v('claim', OWNER2, 'POST', {}, { token: 'x'.repeat(43) })).status).toBe(404);
    expect((await v('claim', OWNER2, 'POST', {}, { token: 'nope' })).status).toBe(400);

    const [{ id }] = await rows<{ id: string }>('SELECT id FROM vendor_invites WHERE token_hash = $1', [hashToken(second)]);
    expect((await a('invites', 'DELETE', { id })).status).toBe(200);
    const cancelled = await v('claim', OWNER2, 'POST', {}, { token: second });
    expect(cancelled.status).toBe(410);
    expect(cancelled.body.error).toMatch(/cancelled/);
    expect((await a('invites', 'DELETE', { id })).status).toBe(409); // cannot cancel twice

    const third = await newInvite();
    await rows("UPDATE vendor_invites SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [hashToken(third)]);
    const expired = await v('claim', OWNER2, 'POST', {}, { token: third });
    expect(expired.status).toBe(410);
    expect(expired.body.error).toMatch(/expired/);
    expect((await v('me', OWNER2)).body.gym).toBeNull(); // still no gym
  });

  it('someone without a gym cannot use any owner tool', async () => {
    for (const [resource, method] of [['draft', 'PUT'], ['submit', 'POST'], ['media', 'POST'], ['bookings', 'GET'], ['reviews', 'GET']] as const) {
      expect((await v(resource, OWNER2, method, {}, {})).status, resource).toBe(403);
    }
  });

  it('the owner builds a draft; invalid input is refused', async () => {
    expect((await v('submit', OWNER, 'POST')).status).toBe(400); // nothing filled in yet
    expect((await v('draft', OWNER, 'PUT', {}, profile({ website: 'javascript:alert(1)' }))).status).toBe(400);
    expect((await v('draft', OWNER, 'PUT', {}, profile({ lat: 51.5, lon: -0.12 }))).status).toBe(400);
    const saved = await v('draft', OWNER, 'PUT', {}, profile());
    expect(saved.status).toBe(200);
    expect(saved.body.gym.draft).toMatchObject({ name: 'Iron Temple', lat: JAIPUR.lat, prices: { month: 1500, day: 200 } });
    expect(saved.body.gym.live).toBeNull();
  });

  it('media: only the owner\'s own, valid, allowed files are accepted', async () => {
    photo1 = blob(gymId, 'front.jpg');
    expect((await v('media', OWNER, 'POST', {}, { kind: 'photo', url: 'https://evil.example/x.jpg' })).status).toBe(400);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'photo', url: blob('vendor-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'theirs.jpg') })).status).toBe(400);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'photo', url: `https://store1.public.blob.vercel-storage.com/vendor/${gymId}/missing.jpg` })).status).toBe(400);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'photo', url: blob(gymId, 'x.gif', 'image/gif') })).status).toBe(400);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'photo', url: blob(gymId, 'huge.jpg', 'image/jpeg', 6 * 1024 * 1024) })).status).toBe(400);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'video', url: blob(gymId, 'huge.mp4', 'video/mp4', 60 * 1024 * 1024) })).status).toBe(400);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'video', url: blob(gymId, 'photo-as-video.jpg') })).status).toBe(400);

    const added = await v('media', OWNER, 'POST', {}, { kind: 'photo', url: photo1, alt: 'Front desk' });
    expect(added.status).toBe(200);
    expect(added.body.gym.media).toEqual([expect.objectContaining({ kind: 'photo', state: 'pending_add', alt: 'Front desk' })]);
    expect((await v('media', OWNER, 'POST', {}, { kind: 'photo', url: photo1 })).status).toBe(409); // same file twice
  });

  it('videos are limited to three', async () => {
    for (let i = 1; i <= 3; i++) {
      expect((await v('media', OWNER, 'POST', {}, { kind: 'video', url: blob(gymId, `tour${i}.mp4`, 'video/mp4', 20_000_000) })).status).toBe(200);
    }
    expect((await v('media', OWNER, 'POST', {}, { kind: 'video', url: blob(gymId, 'tour4.mp4', 'video/mp4') })).status).toBe(409);
    // removing a new file deletes it (and its stored file) straight away
    const view = (await v('me')).body.gym;
    const last = view.media.filter((m: any) => m.kind === 'video').at(-1);
    const removed = await v('media', OWNER, 'DELETE', { id: last.id });
    expect(removed.body.gym.media.filter((m: any) => m.kind === 'video')).toHaveLength(2);
    expect(state.deleted).toContain(last.url);
  });

  it('upload tokens go only to the owner, for their own folder, with fixed types and sizes', async () => {
    const ask = (user: string, pathname: string, kind: string) =>
      call(vendor, 'anon', 'POST', { resource: 'upload' }, { type: 'blob.generate-client-token', pathname, clientPayload: JSON.stringify({ token: `tok_${user}`, kind }) });
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await ask(OWNER, `vendor/${gymId}/a.jpg`, 'photo')).status).toBe(503); // store not set up yet

    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    const photo = await ask(OWNER, `vendor/${gymId}/a.jpg`, 'photo');
    expect(photo.status).toBe(200);
    expect(photo.body).toMatchObject({ allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'], maximumSizeInBytes: 5 * 1024 * 1024, addRandomSuffix: true });
    expect((await ask(OWNER, `vendor/${gymId}/a.mp4`, 'video')).body).toMatchObject({ allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime'], maximumSizeInBytes: 50 * 1024 * 1024 });
    expect((await ask(OWNER2, `vendor/${gymId}/a.jpg`, 'photo')).status).toBe(400); // no gym
    expect((await ask(OWNER, 'vendor/vendor-other/a.jpg', 'photo')).status).toBe(400); // someone else's folder
    expect((await ask(OWNER, `vendor/${gymId}/../x.jpg`, 'photo')).status).toBe(400);
    expect((await ask(OWNER, `vendor/${gymId}/a.jpg`, 'audio')).status).toBe(400);
    const badToken = await call(vendor, 'anon', 'POST', { resource: 'upload' }, { type: 'blob.generate-client-token', pathname: `vendor/${gymId}/a.jpg`, clientPayload: JSON.stringify({ token: 'bad', kind: 'photo' }) });
    expect(badToken.status).toBe(400);
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it('a gym that is not approved is invisible and cannot be booked', async () => {
    const found = await call(gyms, CUSTOMER, 'GET', {}, undefined).catch(() => null);
    expect(found).not.toBeNull(); // missing coordinates is a 400, not a crash
    const near = await call(gyms, CUSTOMER, 'GET', { lat: String(JAIPUR.lat), lon: String(JAIPUR.lon) });
    expect(near.body.gyms.map((g: any) => g.id)).not.toContain(gymId);
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).status).toBe(404);
    expect((await call(bookings, CUSTOMER, 'POST', {}, { gymId, plan: 'month', people: 1 })).status).toBe(404);
  });

  it('submitting puts the gym in the admin queue; editing withdraws it', async () => {
    const sent = await v('submit', OWNER, 'POST');
    expect(sent.body.gym.state).toBe('waiting');

    const queue = (await a('registrations')).body.gyms;
    expect(queue.find((g: any) => g.id === gymId)).toMatchObject({ name: 'Iron Temple', ownerName: 'Priya Sharma', state: 'waiting', firstSubmission: true });
    expect((await a('stats')).body.pendingRegistrations).toBeGreaterThanOrEqual(1);

    const detail = (await a('registrations', 'GET', { id: gymId })).body;
    expect(detail.owner).toEqual({ name: 'Priya Sharma', email: 'priya@gym.test' });
    expect(detail.changes).toEqual(expect.arrayContaining(['Name', 'Address', 'Location', 'Prices']));
    expect(detail.gym.media.some((m: any) => m.state === 'pending_add' && m.kind === 'video')).toBe(true);

    const edited = await v('draft', OWNER, 'PUT', {}, profile({ name: 'Iron Temple Jaipur' }));
    expect(edited.body.gym.state).toBe('draft');
    expect((await a('registrations')).body.gyms.map((g: any) => g.id)).not.toContain(gymId);
    expect((await v('submit', OWNER, 'POST')).body.gym.state).toBe('waiting');
  });

  it('rejecting needs a note, changes nothing publicly, and the owner keeps their work', async () => {
    expect((await decide(gymId, 'reject')).status).toBe(400);
    expect((await decide(gymId, 'reject', '  ')).status).toBe(400);
    expect((await decide(gymId, 'reject', 'Please add a clearer front photo')).status).toBe(200);

    const mine = (await v('me')).body.gym;
    expect(mine).toMatchObject({ state: 'changes_requested', reviewNote: 'Please add a clearer front photo' });
    expect(mine.draft.name).toBe('Iron Temple Jaipur');
    expect(mine.media.length).toBeGreaterThan(0);
    expect((await decide(gymId, 'reject', 'again')).status).toBe(409); // nothing waiting any more

    expect((await v('submit', OWNER, 'POST')).body.gym.reviewNote).toBeNull(); // resubmitting clears the note
  });

  it('approving makes the gym live: found by distance, with media, prices, filters and bookable', async () => {
    expect((await decide(gymId, 'approve')).status).toBe(200);
    const mine = (await v('me')).body.gym;
    expect(mine).toMatchObject({ state: 'live', live: { name: 'Iron Temple Jaipur' } });
    expect(mine.media.every((m: any) => m.state === 'live')).toBe(true);

    const near = await call(gyms, CUSTOMER, 'GET', { lat: String(JAIPUR.lat + 0.01), lon: String(JAIPUR.lon) });
    const found = near.body.gyms.find((g: any) => g.id === gymId);
    expect(found).toMatchObject({ name: 'Iron Temple Jaipur', address: '12 MG Road, Jaipur', features: ['pool', 'sauna'], description: 'Strength floor', bookable: ['day', 'month'], reviewCount: 0 });
    expect(found.prices.month).toBe(1500);
    expect(found.images.map((i: any) => i.url)).toEqual([photo1]);
    expect(found.videos).toHaveLength(2);
    expect(found.distanceKm).toBeLessThan(2);

    const far = await call(gyms, CUSTOMER, 'GET', { lat: String(DELHI.lat), lon: String(DELHI.lon) });
    expect(far.body.gyms.map((g: any) => g.id)).not.toContain(gymId);
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).body.name).toBe('Iron Temple Jaipur');
  });

  it('customers can book and review it; the owner sees both but only first names, no emails', async () => {
    const booked = await call(bookings, CUSTOMER, 'POST', {}, { gymId, plan: 'month', people: 2 });
    expect(booked.status).toBe(201);
    expect(booked.body.booking).toMatchObject({ gymName: 'Iron Temple Jaipur', amountInr: 3000 });
    expect((await call(bookings, CUSTOMER, 'POST', {}, { gymId, plan: 'year', people: 1 })).status).toBe(409); // no year price

    expect((await call(reviews, CUSTOMER, 'POST', {}, { gymId, rating: 4, body: 'Great trainers' })).status).toBe(200);

    const ownerBookings = await v('bookings');
    expect(ownerBookings.body.bookings).toEqual([expect.objectContaining({ userName: 'Carol Customer', plan: 'month', people: 2, amountInr: 3000, status: 'booked' })]);
    expect(JSON.stringify(ownerBookings.body)).not.toContain('carol-secret@fitpath.test');

    const ownerReviews = await v('reviews');
    expect(ownerReviews.body.reviews).toEqual([expect.objectContaining({ userName: 'Carol', rating: 4, body: 'Great trainers' })]);
    expect(ownerReviews.body.summary).toEqual({ rating: 4, reviewCount: 1 });
    expect((await v('me')).body.gym).toMatchObject({ rating: 4, reviewCount: 1 });
  });

  it('owners cannot change bookings, reviews or ratings', async () => {
    for (const resource of ['bookings', 'reviews']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect((await v(resource, OWNER, method, {}, { rating: 5 })).status, `${method} ${resource}`).toBe(405);
    }
    // the customer-side review endpoint refuses an owner who has not booked, so they cannot rate their own gym
    expect((await call(reviews, OWNER, 'POST', {}, { gymId, rating: 5 })).status).toBe(403);
    expect((await v('reviews')).body.summary).toEqual({ rating: 4, reviewCount: 1 });
  });

  it('one owner cannot touch another owner\'s gym', async () => {
    const t = await newInvite();
    const claimed = await v('claim', OWNER2, 'POST', {}, { token: t });
    expect(claimed.status).toBe(201);
    const other = claimed.body.gym.id;

    expect((await v('me', OWNER2)).body.gym.id).toBe(other);
    expect((await v('bookings', OWNER2)).body.bookings).toEqual([]); // sees nothing of the first gym
    const mine = (await v('me', OWNER)).body.gym;
    expect(mine.id).toBe(gymId);
    const mediaOfFirst = mine.media[0].id;
    expect((await v('media', OWNER2, 'DELETE', { id: mediaOfFirst })).status).toBe(404);
    expect((await v('draft', OWNER2, 'PUT', {}, profile({ name: 'Hijacked' }))).body.gym.id).toBe(other);
    expect((await v('me', OWNER)).body.gym.draft.name).toBe('Iron Temple Jaipur');
  });

  it('edits to a live gym wait for approval; the public keeps the old version', async () => {
    const edited = await v('draft', OWNER, 'PUT', {}, profile({ name: 'Iron Temple Premium', prices: { month: 1800, day: 250 } }));
    expect(edited.body.gym).toMatchObject({ state: 'live', hasChanges: true, live: { name: 'Iron Temple Jaipur' } });
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).body).toMatchObject({ name: 'Iron Temple Jaipur' });

    const sent = await v('submit', OWNER, 'POST');
    expect(sent.body.gym.state).toBe('live_pending');
    const detail = (await a('registrations', 'GET', { id: gymId })).body;
    expect(detail.changes).toEqual(['Name', 'Prices']);
    expect((await a('registrations')).body.gyms.find((g: any) => g.id === gymId)).toMatchObject({ firstSubmission: false, state: 'live_pending' });

    // rejected: public unchanged
    await decide(gymId, 'reject', 'Keep the old price for now');
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).body).toMatchObject({ name: 'Iron Temple Jaipur' });
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).body.prices.month).toBe(1500);

    // resubmitted and approved: replaced
    await v('submit', OWNER, 'POST');
    await decide(gymId, 'approve');
    const live = (await call(gym, CUSTOMER, 'GET', { id: gymId })).body;
    expect(live).toMatchObject({ name: 'Iron Temple Premium' });
    expect(live.prices.month).toBe(1800);
  });

  it('removing a live photo stays pending until approved', async () => {
    const mine = (await v('me')).body.gym;
    const live = mine.media.find((m: any) => m.kind === 'photo' && m.state === 'live');
    // add a second photo first so the gym keeps one after the removal
    const second = blob(gymId, 'second.jpg');
    await v('media', OWNER, 'POST', {}, { kind: 'photo', url: second });

    const marked = await v('media', OWNER, 'DELETE', { id: live.id });
    expect(marked.body.gym.media.find((m: any) => m.id === live.id).state).toBe('pending_remove');
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).body.images.map((i: any) => i.url)).toEqual([photo1]); // still public

    const undone = await v('media', OWNER, 'DELETE', { id: live.id });
    expect(undone.body.gym.media.find((m: any) => m.id === live.id).state).toBe('live');
    await v('media', OWNER, 'DELETE', { id: live.id }); // remove again for real

    await v('submit', OWNER, 'POST');
    state.deleted.length = 0;
    await decide(gymId, 'approve');
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).body.images.map((i: any) => i.url)).toEqual([second]);
    expect(state.deleted).toEqual([photo1]);
  });

  it('a submission with no changes is refused; suspending hides the gym and reinstating brings it back', async () => {
    expect((await v('submit', OWNER, 'POST')).status).toBe(409);

    expect((await decide(gymId, 'reinstate')).status).toBe(409); // not suspended
    expect((await decide(gymId, 'suspend')).status).toBe(200);
    expect((await v('me')).body.gym.state).toBe('suspended');
    const near = await call(gyms, CUSTOMER, 'GET', { lat: String(JAIPUR.lat), lon: String(JAIPUR.lon) });
    expect(near.body.gyms.map((g: any) => g.id)).not.toContain(gymId);
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).status).toBe(404);
    expect((await call(bookings, CUSTOMER, 'POST', {}, { gymId, plan: 'day', people: 1 })).status).toBe(404);
    expect((await decide(gymId, 'suspend')).status).toBe(409);

    expect((await decide(gymId, 'reinstate')).status).toBe(200);
    expect((await call(gym, CUSTOMER, 'GET', { id: gymId })).status).toBe(200);
  });

  it('admin does not edit registered gyms as map gyms', async () => {
    expect((await a('gyms', 'PUT', { id: gymId }, { name: 'x' })).status).toBe(400);
    expect((await a('gyms', 'GET', { id: gymId })).status).toBe(400);
  });

  it('the invites list shows each link\'s status and who used it', async () => {
    const list = (await a('invites')).body.invites.filter((i: any) => i.label === LABEL);
    const statuses = list.map((i: any) => i.status).sort();
    expect(statuses).toEqual(expect.arrayContaining(['used', 'cancelled', 'expired']));
    expect(list.find((i: any) => i.ownerName === 'Priya Sharma')).toMatchObject({ status: 'used', gymId });
    expect(JSON.stringify(list)).not.toContain(token);
  });
});
