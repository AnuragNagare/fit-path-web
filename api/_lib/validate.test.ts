import { describe, expect, it } from 'vitest';
import { isGymId, isUuid, parseBookingInput, parseImageInput, parseOverrideInput, parseReviewInput } from './validate.js';

describe('ids', () => {
  it('accepts OpenStreetMap ids and rejects anything else', () => {
    expect(isGymId('node-123')).toBe(true);
    expect(isGymId('way-9')).toBe(true);
    expect(isGymId('node-12; DROP TABLE bookings')).toBe(false);
    expect(isGymId('123')).toBe(false);
    expect(isUuid('3f2b8c1e-5a4d-4e6f-9b0a-1c2d3e4f5a6b')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});

describe('parseBookingInput', () => {
  it('accepts a valid booking', () => {
    expect(parseBookingInput({ gymId: 'node-1', plan: 'month', people: 2 })).toEqual({ ok: true, value: { gymId: 'node-1', plan: 'month', people: 2 } });
  });

  it('rejects bad plans, people counts and gyms', () => {
    expect(parseBookingInput({ gymId: 'node-1', plan: 'trial', people: 1 }).ok).toBe(false);
    expect(parseBookingInput({ gymId: 'node-1', plan: 'day', people: 0 }).ok).toBe(false);
    expect(parseBookingInput({ gymId: 'node-1', plan: 'day', people: 100 }).ok).toBe(false);
    expect(parseBookingInput({ gymId: 'node-1', plan: 'day', people: 1.5 }).ok).toBe(false);
    expect(parseBookingInput({ gymId: 'x', plan: 'day', people: 1 }).ok).toBe(false);
  });

  it('ignores a client-sent amount or dates (the server decides them)', () => {
    const r = parseBookingInput({ gymId: 'node-1', plan: 'day', people: 1, amount: 1, startDate: '2020-01-01' });
    expect(r).toEqual({ ok: true, value: { gymId: 'node-1', plan: 'day', people: 1 } });
  });
});

describe('parseReviewInput', () => {
  it('accepts 1-5 stars with optional text', () => {
    expect(parseReviewInput({ gymId: 'node-1', rating: 5, body: '  Great  ' })).toEqual({ ok: true, value: { gymId: 'node-1', rating: 5, body: 'Great' } });
    expect(parseReviewInput({ gymId: 'node-1', rating: 3 })).toEqual({ ok: true, value: { gymId: 'node-1', rating: 3, body: null } });
  });

  it('rejects out-of-range ratings and long text', () => {
    expect(parseReviewInput({ gymId: 'node-1', rating: 0 }).ok).toBe(false);
    expect(parseReviewInput({ gymId: 'node-1', rating: 6 }).ok).toBe(false);
    expect(parseReviewInput({ gymId: 'node-1', rating: 4.5 }).ok).toBe(false);
    expect(parseReviewInput({ gymId: 'node-1', rating: 4, body: 'x'.repeat(1001) }).ok).toBe(false);
  });
});

describe('parseOverrideInput', () => {
  it('turns empty fields into null and keeps real prices', () => {
    const r = parseOverrideInput({ name: ' Iron Gym ', phone: '', website: 'https://iron.example', prices: { month: 1500, day: null, week: '' }, hidden: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Iron Gym');
      expect(r.value.phone).toBeNull();
      expect(r.value.features).toBeNull();
      expect(r.value.prices).toEqual({ month: 1500 });
      expect(r.value.hidden).toBe(true);
    }
  });

  it('rejects non-http websites, bad prices and bad features', () => {
    expect(parseOverrideInput({ website: 'javascript:alert(1)' }).ok).toBe(false);
    expect(parseOverrideInput({ prices: { month: -1 } }).ok).toBe(false);
    expect(parseOverrideInput({ prices: { month: 99.5 } }).ok).toBe(false);
    expect(parseOverrideInput({ prices: { month: 2_000_000 } }).ok).toBe(false);
    expect(parseOverrideInput({ features: ['ok', 'Not OK!'] }).ok).toBe(false);
    expect(parseOverrideInput({ name: 'x'.repeat(121) }).ok).toBe(false);
  });

  it('keeps the chosen features, without duplicates', () => {
    const r = parseOverrideInput({ features: ['pool', 'pool', 'sauna'] });
    expect(r.ok && r.value.features).toEqual(['pool', 'sauna']);
  });
});

describe('parseImageInput', () => {
  const ok = { gymId: 'node-1', contentType: 'image/jpeg', data: 'QUJD', alt: 'Front desk' };

  it('accepts a small base64 image', () => {
    expect(parseImageInput(ok).ok).toBe(true);
  });

  it('rejects other types, bad base64 and oversized images', () => {
    expect(parseImageInput({ ...ok, contentType: 'image/svg+xml' }).ok).toBe(false);
    expect(parseImageInput({ ...ok, data: 'not base64!' }).ok).toBe(false);
    expect(parseImageInput({ ...ok, data: 'A'.repeat(4_300_000) }).ok).toBe(false);
  });
});
