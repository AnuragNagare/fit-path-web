import { BOOKING_COLUMNS, toAdminBooking, type BookingRow } from '../booking-model.js';
import { rows } from '../db.js';
import { bodyObject, queryParam, type ApiRequest, type ApiResponse } from '../http.js';
import { todayIST } from '../plans.js';
import { isUuid } from '../validate.js';

export const PAGE_SIZE = 50;

export function parsePage(req: ApiRequest): number {
  const n = Number(queryParam(req, 'page'));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

// Escapes LIKE wildcards so a search for "50%" does not match everything.
export const likePattern = (s: string) => `%${s.replace(/[\\%_]/g, c => `\\${c}`)}%`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET   admin?resource=bookings[&page&status&q&gym&from&to]  ->  { bookings, total, page, pageSize }
// PATCH admin?resource=bookings {id, status?, paymentStatus?}  ->  { booking }
export async function adminBookings(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => { params.push(value); where.push(clause.replaceAll('?', `$${params.length}`)); };

    const status = queryParam(req, 'status');
    if (status === 'booked' || status === 'cancelled') add('status = ?', status);
    const q = queryParam(req, 'q')?.trim().slice(0, 100);
    if (q) add("(user_name ILIKE ? OR user_email ILIKE ?)", likePattern(q));
    const gym = queryParam(req, 'gym')?.trim().slice(0, 100);
    if (gym) add('gym_name ILIKE ?', likePattern(gym));
    const from = queryParam(req, 'from');
    if (from && DATE.test(from)) add('start_date >= ?::date', from);
    const to = queryParam(req, 'to');
    if (to && DATE.test(to)) add('start_date <= ?::date', to);

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = parsePage(req);
    const [list, count] = await Promise.all([
      rows<BookingRow>(
        `SELECT ${BOOKING_COLUMNS} FROM bookings ${clause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
        params,
      ),
      rows<{ n: number }>(`SELECT count(*)::int AS n FROM bookings ${clause}`, params),
    ]);
    return res.status(200).json({ bookings: list.map(toAdminBooking), total: count[0]?.n ?? 0, page, pageSize: PAGE_SIZE });
  }

  if (req.method === 'PATCH') {
    const body = bodyObject(req);
    if (!isUuid(body.id)) return res.status(400).json({ error: 'Invalid booking.' });
    const status = body.status;
    const payment = body.paymentStatus;
    if (status !== undefined && status !== 'booked' && status !== 'cancelled') return res.status(400).json({ error: 'Invalid status.' });
    if (payment !== undefined && payment !== 'due' && payment !== 'paid' && payment !== 'refunded') {
      return res.status(400).json({ error: 'Invalid payment status.' });
    }
    if (status === undefined && payment === undefined) return res.status(400).json({ error: 'Nothing to change.' });

    const [updated] = await rows<BookingRow>(
      `UPDATE bookings SET status = coalesce($2, status), payment_status = coalesce($3, payment_status), updated_at = now()
       WHERE id = $1 RETURNING ${BOOKING_COLUMNS}`,
      [body.id, status ?? null, payment ?? null],
    );
    if (!updated) return res.status(404).json({ error: 'Booking not found.' });
    return res.status(200).json({ booking: toAdminBooking(updated) });
  }

  res.setHeader('Allow', 'GET, PATCH');
  res.status(405).json({ error: 'Method not allowed.' });
}

// GET admin?resource=stats  ->  headline numbers for the dashboard
export async function adminStats(_req: ApiRequest, res: ApiResponse) {
  const today = todayIST();
  const [[b], [r], [g], [v]] = await Promise.all([
    rows<Record<string, number>>(
      `SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'booked' AND end_date >= $1::date)::int AS active,
        count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        count(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date)::int AS new_today,
        coalesce(sum(amount_inr) FILTER (WHERE status = 'booked' AND payment_status = 'due'), 0)::int AS amount_due,
        coalesce(sum(amount_inr) FILTER (WHERE status = 'booked' AND payment_status = 'paid'), 0)::int AS amount_paid
       FROM bookings`,
      [today],
    ),
    rows<{ n: number }>('SELECT count(*)::int AS n FROM reviews'),
    rows<{ n: number }>('SELECT count(*)::int AS n FROM gym_overrides'),
    rows<{ n: number }>('SELECT count(*)::int AS n FROM vendor_gyms WHERE draft_submitted_at IS NOT NULL'),
  ]);
  res.status(200).json({
    bookings: { total: b.total, active: b.active, cancelled: b.cancelled, newToday: b.new_today },
    amountDueInr: b.amount_due,
    amountPaidInr: b.amount_paid,
    reviews: r.n,
    editedGyms: g.n,
    pendingRegistrations: v.n,
  });
}
