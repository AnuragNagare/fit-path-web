import { describe, expect, it } from 'vitest';
import { endDateFor, isPlan, PLANS, resolvePrices, samplePrices, todayIST } from './plans.js';

describe('endDateFor (inclusive end date)', () => {
  it('day pass starts and ends the same day', () => {
    expect(endDateFor('day', '2026-10-14')).toBe('2026-10-14');
  });

  it('week covers 7 days', () => {
    expect(endDateFor('week', '2026-10-14')).toBe('2026-10-20');
    expect(endDateFor('week', '2026-12-28')).toBe('2027-01-03');
  });

  it('month runs to the day before the same date next month', () => {
    expect(endDateFor('month', '2026-10-14')).toBe('2026-11-13');
    expect(endDateFor('month', '2026-12-15')).toBe('2027-01-14');
  });

  it('month from the 1st ends on the last day of that month', () => {
    expect(endDateFor('month', '2026-11-01')).toBe('2026-11-30');
  });

  it('clamps to the end of a shorter month', () => {
    expect(endDateFor('month', '2026-01-31')).toBe('2026-02-27');
    expect(endDateFor('month', '2028-01-31')).toBe('2028-02-28'); // leap year: Feb 29 minus a day
  });

  it('3 months, 6 months and 1 year', () => {
    expect(endDateFor('quarter', '2026-10-14')).toBe('2027-01-13');
    expect(endDateFor('half', '2026-10-14')).toBe('2027-04-13');
    expect(endDateFor('year', '2026-10-14')).toBe('2027-10-13');
  });

  it('year from a leap day', () => {
    expect(endDateFor('year', '2028-02-29')).toBe('2029-02-27');
  });
});

describe('todayIST', () => {
  it('uses India time, not UTC', () => {
    expect(todayIST(new Date('2026-10-14T20:00:00Z'))).toBe('2026-10-15'); // 01:30 IST next day
    expect(todayIST(new Date('2026-10-14T12:00:00Z'))).toBe('2026-10-14');
  });
});

describe('prices', () => {
  it('sample prices are stable per gym and get more expensive with longer plans', () => {
    const a = samplePrices('node-1');
    expect(samplePrices('node-1')).toEqual(a);
    const values = PLANS.map(p => a[p]);
    expect([...values].sort((x, y) => x - y)).toEqual(values);
    expect(a.month).toBeGreaterThanOrEqual(999);
    expect(a.month).toBeLessThanOrEqual(2499);
  });

  it('real prices override samples and mark only those plans as bookable', () => {
    const { prices, bookable } = resolvePrices('node-1', { month: 1800, year: 15000 });
    expect(prices.month).toBe(1800);
    expect(prices.year).toBe(15000);
    expect(prices.day).toBe(samplePrices('node-1').day);
    expect(bookable).toEqual(['month', 'year']);
  });

  it('ignores zero, negative, fractional and non-numeric real prices', () => {
    const { bookable } = resolvePrices('node-1', { day: 0, week: -5, month: 12.5, quarter: '900' as unknown as number });
    expect(bookable).toEqual([]);
    expect(resolvePrices('node-1', null).bookable).toEqual([]);
  });

  it('isPlan accepts only the six plans', () => {
    expect(PLANS.every(isPlan)).toBe(true);
    expect(isPlan('trial')).toBe(false);
    expect(isPlan(undefined)).toBe(false);
  });
});
