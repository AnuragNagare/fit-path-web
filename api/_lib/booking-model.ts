import type { Plan } from './plans.js';

// Columns to select so dates come back as plain 'YYYY-MM-DD' strings.
export const BOOKING_COLUMNS =
  'id, clerk_user_id, user_name, user_email, gym_id, gym_name, plan, start_date::text AS start_date, end_date::text AS end_date, people, amount_inr, status, payment_status, created_at';

export type BookingRow = {
  id: string;
  clerk_user_id: string;
  user_name: string;
  user_email: string;
  gym_id: string;
  gym_name: string;
  plan: Plan;
  start_date: string;
  end_date: string;
  people: number;
  amount_inr: number;
  status: 'booked' | 'cancelled';
  payment_status: 'due' | 'paid' | 'refunded';
  created_at: string | Date;
};

// What the user sees (no email or Clerk id).
export function toUserBooking(r: BookingRow) {
  return {
    id: r.id,
    gymId: r.gym_id,
    gymName: r.gym_name,
    plan: r.plan,
    startDate: r.start_date,
    endDate: r.end_date,
    people: r.people,
    amountInr: r.amount_inr,
    status: r.status,
    paymentStatus: r.payment_status,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// What the admin sees: the same plus who booked.
export function toAdminBooking(r: BookingRow) {
  return { ...toUserBooking(r), userName: r.user_name, userEmail: r.user_email };
}

// A booking can be cancelled while it is still booked and has not ended.
export function canCancel(booking: { status: string; end_date: string }, today: string): boolean {
  return booking.status === 'booked' && booking.end_date >= today;
}
