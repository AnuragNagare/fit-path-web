import { authUser } from './_lib/auth.js';
import { rows } from './_lib/db.js';
import { ratingStats } from './_lib/gym-data.js';
import { bodyObject, queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { isGymId, isUuid, parseReviewInput } from './_lib/validate.js';

type ReviewRow = { id: string; clerk_user_id: string; user_name: string; rating: number; body: string | null; hidden: boolean; created_at: string | Date };

// Other users only see a reviewer's first name.
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Member';

// GET    /api/reviews?gymId=node-1       ->  { reviews, summary, canReview, mine }
// POST   /api/reviews {gymId,rating,body} ->  { ok }  add or replace the caller's review (needs a booking at that gym)
// DELETE /api/reviews?id=<uuid>          ->  { ok }  delete the caller's own review
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await authUser(req, res);
  if (!userId) return;

  try {
    if (req.method === 'GET') {
      const gymId = queryParam(req, 'gymId');
      if (!isGymId(gymId)) return res.status(400).json({ error: 'Invalid gym.' });

      const [list, booking] = await Promise.all([
        rows<ReviewRow>(
          'SELECT id, clerk_user_id, user_name, rating, body, hidden, created_at FROM reviews WHERE gym_id = $1 ORDER BY created_at DESC LIMIT 200',
          [gymId],
        ),
        rows("SELECT 1 FROM bookings WHERE clerk_user_id = $1 AND gym_id = $2 AND status = 'booked' LIMIT 1", [userId, gymId]),
      ]);
      const visible = list.filter(r => !r.hidden);
      const mine = list.find(r => r.clerk_user_id === userId) ?? null;
      return res.status(200).json({
        reviews: visible.map(r => ({
          id: r.id,
          userName: firstName(r.user_name),
          rating: r.rating,
          body: r.body,
          createdAt: new Date(r.created_at).toISOString(),
          mine: r.clerk_user_id === userId,
        })),
        summary: ratingStats(visible.reduce((sum, r) => sum + r.rating, 0), visible.length),
        canReview: booking.length > 0,
        mine: mine ? { id: mine.id, rating: mine.rating, body: mine.body, hidden: mine.hidden } : null,
      });
    }

    if (req.method === 'POST') {
      const input = parseReviewInput(bodyObject(req));
      if (!input.ok) return res.status(400).json({ error: input.error });
      const { gymId, rating, body } = input.value;

      // Only people who booked the gym can review it; their booking also supplies the name and gym name.
      const [booking] = await rows<{ gym_name: string; user_name: string; user_email: string }>(
        "SELECT gym_name, user_name, user_email FROM bookings WHERE clerk_user_id = $1 AND gym_id = $2 AND status = 'booked' ORDER BY created_at DESC LIMIT 1",
        [userId, gymId],
      );
      if (!booking) return res.status(403).json({ error: 'Book this gym to leave a review.' });

      await rows(
        `INSERT INTO reviews (gym_id, gym_name, clerk_user_id, user_name, user_email, rating, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (gym_id, clerk_user_id) DO UPDATE SET rating = $6, body = $7, edited_by_admin = false, updated_at = now()`,
        [gymId, booking.gym_name, userId, booking.user_name, booking.user_email, rating, body],
      );
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = queryParam(req, 'id');
      if (!isUuid(id)) return res.status(400).json({ error: 'Invalid review.' });
      const deleted = await rows('DELETE FROM reviews WHERE id = $1 AND clerk_user_id = $2 RETURNING id', [id, userId]);
      if (deleted.length === 0) return res.status(404).json({ error: 'Review not found.' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('reviews', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Something went wrong. Please try again.' });
  }
}
