import { describe, expect, it } from 'vitest';
import { timeZoneAt, wallClockIn } from './zones.js';

describe('opening hours are read on the gym\'s own clock', () => {
  it('finds the right time zone in cities around the world', () => {
    expect(timeZoneAt(19.07, 72.87)).toBe('Asia/Kolkata');
    expect(timeZoneAt(38.9, -77.03)).toBe('America/New_York'); // Washington, DC
    expect(timeZoneAt(51.5, -0.12)).toBe('Europe/London');
    expect(timeZoneAt(-33.86, 151.2)).toBe('Australia/Sydney');
    expect(timeZoneAt(35.68, 139.7)).toBe('Asia/Tokyo');
  });

  it('falls back to UTC for impossible coordinates', () => {
    expect(timeZoneAt(95, 10)).toBe('UTC');
  });

  it('the wall clock reads local time there, whatever the server clock is', () => {
    const moment = new Date('2026-10-14T20:00:00Z');
    const tokyo = wallClockIn('Asia/Tokyo', moment); // 05:00 on the 15th
    expect([tokyo.getFullYear(), tokyo.getMonth() + 1, tokyo.getDate(), tokyo.getHours(), tokyo.getMinutes()]).toEqual([2026, 10, 15, 5, 0]);
    const dc = wallClockIn('America/New_York', moment); // 16:00 (EDT)
    expect([dc.getDate(), dc.getHours()]).toEqual([14, 16]);
    const india = wallClockIn('Asia/Kolkata', moment); // 01:30 on the 15th, what the app used for everyone before
    expect([india.getDate(), india.getHours(), india.getMinutes()]).toEqual([15, 1, 30]);
  });

  it('follows daylight saving', () => {
    expect(wallClockIn('America/New_York', new Date('2026-07-01T12:00:00Z')).getHours()).toBe(8); // UTC-4
    expect(wallClockIn('America/New_York', new Date('2026-12-01T12:00:00Z')).getHours()).toBe(7); // UTC-5
  });
});
