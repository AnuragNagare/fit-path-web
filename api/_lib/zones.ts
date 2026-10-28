import tzlookup from 'tz-lookup';

// Search results show whether a gym is open now. Opening hours are written in the gym's local time,
// so "now" has to be read off that gym's own clock, wherever in the world it is.

// The IANA time zone at a point (e.g. "Asia/Kolkata"), or UTC if it cannot be found.
export function timeZoneAt(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

// A Date whose local fields read the wall clock in `timeZone` (what opening-hours rules are written against).
export function wallClockIn(timeZone: string, now: Date = new Date()): Date {
  const p: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
