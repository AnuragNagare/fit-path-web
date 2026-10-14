import { rows } from '../db.js';
import { bodyObject, queryParam, type ApiRequest, type ApiResponse } from '../http.js';
import { isUuid } from '../validate.js';
import { likePattern, PAGE_SIZE, parsePage } from './bookings.js';

type AdminReviewRow = {
  id: string;
  gym_id: string;
  gym_name: string;
  user_name: string;
  user_email: string;
  rating: number;
  body: string | null;
  hidden: boolean;
  edited_by_admin: boolean;
  created_at: string | Date;
};

const COLUMNS = 'id, gym_id, gym_name, user_name, user_email, rating, body, hidden, edited_by_admin, created_at';

const toAdminReview = (r: AdminReviewRow) => ({
  id: r.id,
  gymId: r.gym_id,
  gymName: r.gym_name,
  userName: r.user_name,
  userEmail: r.user_email,
  rating: r.rating,
  body: r.body,
  hidden: r.hidden,
  editedByAdmin: r.edited_by_admin,
  createdAt: new Date(r.created_at).toISOString(),
});

// GET    admin?resource=reviews[&page&rating&gym&status]  ->  { reviews, total, page, pageSize }
// PATCH  admin?resource=reviews {id, body?, hidden?}      ->  { review }
// DELETE admin?resource=reviews&id=<uuid>                 ->  { ok }
export async function adminReviews(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => { params.push(value); where.push(clause.replaceAll('?', `$${params.length}`)); };

    const rating = Number(queryParam(req, 'rating'));
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) add('rating = ?', rating);
    const gym = queryParam(req, 'gym')?.trim().slice(0, 100);
    if (gym) add('gym_name ILIKE ?', likePattern(gym));
    const status = queryParam(req, 'status');
    if (status === 'visible') where.push('NOT hidden');
    if (status === 'hidden') where.push('hidden');

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = parsePage(req);
    const [list, count] = await Promise.all([
      rows<AdminReviewRow>(
        `SELECT ${COLUMNS} FROM reviews ${clause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
        params,
      ),
      rows<{ n: number }>(`SELECT count(*)::int AS n FROM reviews ${clause}`, params),
    ]);
    return res.status(200).json({ reviews: list.map(toAdminReview), total: count[0]?.n ?? 0, page, pageSize: PAGE_SIZE });
  }

  if (req.method === 'PATCH') {
    const body = bodyObject(req);
    if (!isUuid(body.id)) return res.status(400).json({ error: 'Invalid review.' });
    if (body.hidden !== undefined && typeof body.hidden !== 'boolean') return res.status(400).json({ error: 'Invalid hidden flag.' });
    let text: string | null | undefined;
    if (body.body !== undefined) {
      if (body.body !== null && typeof body.body !== 'string') return res.status(400).json({ error: 'Invalid text.' });
      text = body.body === null ? null : body.body.trim() || null;
      if (text && text.length > 1000) return res.status(400).json({ error: 'Keep the review under 1000 characters.' });
    }
    if (text === undefined && body.hidden === undefined) return res.status(400).json({ error: 'Nothing to change.' });

    const [updated] = await rows<AdminReviewRow>(
      `UPDATE reviews SET
         body = CASE WHEN $2::boolean THEN $3 ELSE body END,
         edited_by_admin = edited_by_admin OR $2::boolean,
         hidden = coalesce($4::boolean, hidden),
         updated_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [body.id, text !== undefined, text ?? null, typeof body.hidden === 'boolean' ? body.hidden : null],
    );
    if (!updated) return res.status(404).json({ error: 'Review not found.' });
    return res.status(200).json({ review: toAdminReview(updated) });
  }

  if (req.method === 'DELETE') {
    const id = queryParam(req, 'id');
    if (!isUuid(id)) return res.status(400).json({ error: 'Invalid review.' });
    const deleted = await rows('DELETE FROM reviews WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) return res.status(404).json({ error: 'Review not found.' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  res.status(405).json({ error: 'Method not allowed.' });
}
