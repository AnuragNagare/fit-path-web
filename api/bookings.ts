import { authUser, getClerkProfile } from './_lib/auth.js';
import { BOOKING_COLUMNS, canCancel, toUserBooking, type BookingRow } from './_lib/booking-model.js';
import { rows } from './_lib/db.js';
import { enrichGyms } from './_lib/gym-data.js';
import { loadGym } from './_lib/gym-lookup.js';
import { bodyObject, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { endDateFor, PLAN_LABELS, todayIST } from './_lib/plans.js';
import { isUuid, parseBookingInput } from './_lib/validate.js';

// GET   /api/bookings                      ->  { bookings }   the caller's own bookings, newest first
// POST  /api/bookings {gymId, plan, people} ->  { booking }    reserve now; the dates and the amount are set here
// PATCH /api/bookings {id}                 ->  { booking }    cancel one of the caller's own bookings
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await authUser(req, res);
  if (!userId) return;

  try {
    if (req.method === 'GET') {
      const list = await rows<BookingRow>(
        `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE clerk_user_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [userId],
      );
      return res.status(200).json({ bookings: list.map(toUserBooking) });
    }

    if (req.method === 'POST') {
      const input = parseBookingInput(bodyObject(req));
      if (!input.ok) return res.status(400).json({ error: input.error });
      const { gymId, plan, people } = input.value;

      const osm = await loadGym(gymId);
      const [gym] = osm ? await enrichGyms([osm]) : [];
      if (!gym) return res.status(404).json({ error: 'Gym not found.' });
      if (!gym.bookable.includes(plan)) {
        return res.status(409).json({ error: `${gym.name} has not set a price for the ${PLAN_LABELS[plan].toLowerCase()} plan yet.` });
      }

      const startDate = todayIST();
      const [active] = await rows(
        "SELECT 1 FROM bookings WHERE clerk_user_id = $1 AND gym_id = $2 AND status = 'booked' AND end_date >= $3::date LIMIT 1",
        [userId, gymId, startDate],
      );
      if (active) return res.status(409).json({ error: 'You already have an active booking at this gym.' });

      const profile = await getClerkProfile(userId);
      const [created] = await rows<BookingRow>(
        `INSERT INTO bookings (clerk_user_id, user_name, user_email, gym_id, gym_name, plan, start_date, end_date, people, amount_inr)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10)
         RETURNING ${BOOKING_COLUMNS}`,
        [userId, profile.name, profile.email, gymId, gym.name, plan, startDate, endDateFor(plan, startDate), people, gym.prices[plan] * people],
      );
      return res.status(201).json({ booking: toUserBooking(created) });
    }

    if (req.method === 'PATCH') {
      const id = bodyObject(req).id;
      if (!isUuid(id)) return res.status(400).json({ error: 'Invalid booking.' });
      const [booking] = await rows<BookingRow>(
        `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1 AND clerk_user_id = $2`,
        [id, userId],
      );
      if (!booking) return res.status(404).json({ error: 'Booking not found.' });
      if (!canCancel(booking, todayIST())) return res.status(409).json({ error: "This booking can't be cancelled." });
      const [updated] = await rows<BookingRow>(
        `UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING ${BOOKING_COLUMNS}`,
        [id],
      );
      return res.status(200).json({ booking: toUserBooking(updated) });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('bookings', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Something went wrong. Please try again.' });
  }
}
