// Membership plans, their automatic dates, and the sample prices shown until a gym sets real ones.
// Dates are plain 'YYYY-MM-DD' strings. A booking starts the day it is made (India's calendar)
// and its end date is inclusive: a day pass starts and ends on the same day.

export const PLANS = ['day', 'week', 'month', 'quarter', 'half', 'year'] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  day: 'Day pass',
  week: '1 week',
  month: '1 month',
  quarter: '3 months',
  half: '6 months',
  year: '1 year',
};

export type PlanPrices = Record<Plan, number>;
export type PartialPlanPrices = Partial<Record<Plan, number>>;

export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLANS as readonly string[]).includes(value);
}

const IST_OFFSET_MS = 330 * 60_000;

// Today's date on India's wall clock (the app is India-only and India has no daylight saving).
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function format(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

// Same day number `months` later, or the month's last day when it has no such day (Jan 31 + 1 month = Feb 28/29).
function addMonths(date: string, months: number): { y: number; m: number; d: number } {
  const { y, m, d } = parseDate(date);
  const target = m - 1 + months;
  const ty = y + Math.floor(target / 12);
  const tm = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return { y: ty, m: tm, d: Math.min(d, lastDay) };
}

// Inclusive end date: day = same day, week = 7 days, then whole calendar months.
export function endDateFor(plan: Plan, start: string): string {
  const months = { month: 1, quarter: 3, half: 6, year: 12 }[plan as 'month' | 'quarter' | 'half' | 'year'];
  if (months === undefined) {
    const { y, m, d } = parseDate(start);
    return format(y, m - 1, d + (plan === 'week' ? 6 : 0));
  }
  const next = addMonths(start, months);
  return format(next.y, next.m, next.d - 1);
}

function hashId(gymId: string): number {
  let hash = 0;
  for (let i = 0; i < gymId.length; i++) hash = (hash * 31 + gymId.charCodeAt(i)) >>> 0;
  return hash;
}

// Ends in 9, like a price tag: 1,499 rather than 1,500.
const tag = (n: number) => Math.round(n / 10) * 10 - 1;

// SAMPLE prices (not real), stable per gym: monthly 999-2,499, other plans scaled from it.
export function samplePrices(gymId: string): PlanPrices {
  const month = 999 + ((hashId(gymId) >>> 8) % 16) * 100;
  return {
    day: tag(month * 0.18),
    week: tag(month * 0.4),
    month,
    quarter: tag(month * 2.7),
    half: tag(month * 5),
    year: tag(month * 9),
  };
}

// Real prices set by the admin override the sample ones; `bookable` lists the plans that have a real price.
export function resolvePrices(gymId: string, real: PartialPlanPrices | null | undefined): { prices: PlanPrices; bookable: Plan[] } {
  const prices = samplePrices(gymId);
  const bookable: Plan[] = [];
  for (const plan of PLANS) {
    const value = real?.[plan];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      prices[plan] = value;
      bookable.push(plan);
    }
  }
  return { prices, bookable };
}
