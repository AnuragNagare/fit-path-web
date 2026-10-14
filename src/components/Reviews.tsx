import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import type { ReviewsResult } from '@/types';
import { useApi } from '@/lib/api';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={size} fill={n <= value ? 'currentColor' : 'none'} />)}
    </span>
  );
}

export default function Reviews({ gymId }: { gymId: string }) {
  const { reviews } = useApi();
  const [data, setData] = useState<ReviewsResult | null>(null);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await reviews.get(gymId));
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load reviews.");
    }
  }, [reviews, gymId]);

  useEffect(() => { void load(); }, [load]);

  function startEdit() {
    setRating(data?.mine?.rating ?? 0);
    setText(data?.mine?.body ?? '');
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) { setError('Choose a star rating.'); return; }
    setSaving(true);
    setError('');
    try {
      await reviews.save(gymId, rating, text);
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your review.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!data?.mine) return;
    try {
      await reviews.remove(data.mine.id);
      setRating(0);
      setText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your review.");
    }
  }

  const showForm = data?.canReview && (!data.mine || editing);

  return (
    <section className="gd-section gd-reviews">
      <div className="gd-row">
        <h2>Reviews{data && data.summary.reviewCount > 0 ? ` (${data.summary.reviewCount})` : ''}</h2>
        {data?.summary.rating != null && <span className="reviews-avg"><Star size={16} fill="currentColor" /> {data.summary.rating}</span>}
      </div>

      {loadError && <p className="field-error">{loadError}</p>}
      {data && data.reviews.length === 0 && !data.mine && <p className="listing-empty">No reviews yet.</p>}

      {data && !data.canReview && !data.mine && <p className="book-note">Book this gym to leave a review.</p>}

      {showForm && (
        <form className="review-form" onSubmit={save}>
          <div className="review-stars" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>
                <Star size={26} fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} placeholder="What was it like? (optional)" aria-label="Your review" />
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="review-actions">
            <button type="submit" className="pill-button compact" disabled={saving}>{saving ? 'Saving…' : data?.mine ? 'Update review' : 'Post review'}</button>
            {editing && <button type="button" className="gd-link" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}

      {data?.mine?.hidden && !editing && <p className="book-note">Your review is hidden from other people.</p>}
      {data?.mine && !editing && (
        <div className="review-mine-actions">
          <button type="button" className="gd-link" onClick={startEdit}>Edit your review</button>
          <button type="button" className="gd-link" onClick={remove}>Delete</button>
        </div>
      )}

      <ul className="review-list">
        {data?.reviews.map(r => (
          <li key={r.id}>
            <div className="review-head">
              <strong>{r.mine ? `${r.userName} (you)` : r.userName}</strong>
              <Stars value={r.rating} />
              <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
            </div>
            {r.body && <p>{r.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
