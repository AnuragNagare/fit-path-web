import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useApi } from '@/lib/api';
import { formatDateTime } from './format';
import Pager from './Pager';

type AdminReview = {
  id: string;
  gymId: string;
  gymName: string;
  userName: string;
  userEmail: string;
  rating: number;
  body: string | null;
  hidden: boolean;
  editedByAdmin: boolean;
  createdAt: string;
};
type Filters = { gym: string; rating: string; status: string };
const NO_FILTERS: Filters = { gym: '', rating: '', status: '' };

export default function AdminReviews() {
  const { admin } = useApi();
  const [form, setForm] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ reviews: AdminReview[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    admin
      .get<{ reviews: AdminReview[]; total: number; pageSize: number }>('reviews', { ...applied, page })
      .then(result => { if (!cancelled) { setData(result); setError(''); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load reviews."); });
    return () => { cancelled = true; };
  }, [admin, applied, page]);

  function replace(review: AdminReview) {
    setData(d => d && { ...d, reviews: d.reviews.map(r => (r.id === review.id ? review : r)) });
  }

  async function patch(id: string, body: { body?: string | null; hidden?: boolean }) {
    try {
      const { review } = await admin.patch<{ review: AdminReview }>('reviews', { id, ...body });
      replace(review);
      setEditing(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the review.");
    }
  }

  async function remove(id: string) {
    try {
      await admin.del('reviews', { id });
      setData(d => d && { ...d, total: d.total - 1, reviews: d.reviews.filter(r => r.id !== id) });
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the review.");
    }
  }

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <h1 className="admin-title">Reviews</h1>

      <form className="admin-filters" onSubmit={e => { e.preventDefault(); setPage(1); setApplied(form); }}>
        <label>Gym<input type="search" value={form.gym} onChange={set('gym')} placeholder="Gym name" /></label>
        <label>Rating
          <select value={form.rating} onChange={set('rating')}>
            <option value="">Any</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
          </select>
        </label>
        <label>Showing
          <select value={form.status} onChange={set('status')}>
            <option value="">All</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <div className="admin-filter-actions">
          <button type="submit" className="pill-button compact">Search</button>
          <button type="button" className="gd-link" onClick={() => { setForm(NO_FILTERS); setApplied(NO_FILTERS); setPage(1); }}>Clear</button>
        </div>
      </form>

      {error && <p className="field-error" role="alert">{error}</p>}
      {!data && !error && <p className="listing-empty">Loading…</p>}
      {data && data.reviews.length === 0 && <p className="listing-empty">No reviews match.</p>}

      <ul className="admin-reviews">
        {data?.reviews.map(r => (
          <li key={r.id} className={r.hidden ? 'is-hidden' : ''}>
            <div className="admin-review-head">
              <strong>{r.gymName}</strong>
              <span className="stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={15} fill={n <= r.rating ? 'currentColor' : 'none'} />)}
              </span>
              {r.hidden && <span className="status-badge status-badge--cancelled">Hidden</span>}
              {r.editedByAdmin && <span className="status-badge status-badge--ended">Edited by admin</span>}
            </div>
            <p className="muted">{r.userName} · {r.userEmail} · {formatDateTime(r.createdAt)}</p>

            {editing?.id === r.id ? (
              <div className="admin-review-edit">
                <textarea value={editing.text} onChange={e => setEditing({ id: r.id, text: e.target.value })} maxLength={1000} rows={3} aria-label="Review text" />
                <div className="review-actions">
                  <button type="button" className="pill-button compact" onClick={() => patch(r.id, { body: editing.text })}>Save</button>
                  <button type="button" className="gd-link" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p>{r.body ?? <em className="muted">No text</em>}</p>
            )}

            <div className="admin-row-actions">
              <button type="button" className="gd-link" onClick={() => setEditing({ id: r.id, text: r.body ?? '' })}>Edit text</button>
              <button type="button" className="gd-link" onClick={() => patch(r.id, { hidden: !r.hidden })}>{r.hidden ? 'Show' : 'Hide'}</button>
              {confirmDelete === r.id ? (
                <>
                  <button type="button" className="gd-link danger" onClick={() => remove(r.id)}>Confirm delete</button>
                  <button type="button" className="gd-link" onClick={() => setConfirmDelete(null)}>Keep</button>
                </>
              ) : (
                <button type="button" className="gd-link danger" onClick={() => setConfirmDelete(r.id)}>Delete</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {data && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </>
  );
}
