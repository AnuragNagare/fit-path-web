import type { Plan } from '@/types';

// Shown in the UI; the server owns the dates and prices (api/_lib/plans.ts).
export const PLANS: Plan[] = ['day', 'week', 'month', 'quarter', 'half', 'year'];

export const PLAN_LABELS: Record<Plan, string> = {
  day: 'Day pass',
  week: '1 week',
  month: '1 month',
  quarter: '3 months',
  half: '6 months',
  year: '1 year',
};

// "Pay at the gym" is all a booking does for now; online payment comes later.
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} to ${formatDate(end)}`;
}
