import { useCallback, useEffect, useState } from 'react';
import { Star, ThumbsUp } from 'lucide-react';
import type { ReviewsResult } from '@/types';
import { useApi } from '@/lib/api';

function getDescriptor(rating: number): string {
  const score = rating * 2; // convert 5-point to 10-point for display
  if (score >= 9.0) return 'Exceptional';
  if (score >= 8.5) return 'Wonderful';
  if (score >= 8.0) return 'Very Good';
  if (score >= 7.0) return 'Good';
  return 'Pleasant';
}

function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="gp-stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} fill={n <= value ? 'currentColor' : 'none'} color={n <= value ? '#FFB703' : '#D0D5DD'} />
      ))}
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
  const [hoverRating, setHoverRating] = useState(0);

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
  const summaryRating = data?.summary.rating ?? null;
  const reviewCount = data?.summary.reviewCount ?? 0;
  const displayScore = summaryRating !== null ? (summaryRating * 2).toFixed(1) : null;

  return (
    <section className="gp-section" id="reviews">
      <h2 className="gp-section-title">Guest Reviews</h2>

      {loadError && <p className="field-error">{loadError}</p>}

      {/* Score Summary Block — Booking.com style */}
      {displayScore !== null && (
        <div className="gp-reviews-summary">
          <div className="gp-reviews-summary__badge-wrap">
            <div className="gp-reviews-summary__badge">
              {displayScore}
            </div>
            <div className="gp-reviews-summary__meta">
              <strong className="gp-reviews-summary__descriptor">
                {getDescriptor(summaryRating!)}
              </strong>
              <span className="gp-reviews-summary__count">
                Based on {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>

          {/* Overall rating progress bar */}
          <div className="gp-reviews-summary__bar-section">
            <div className="gp-rating-bar-row">
              <span className="gp-rating-bar-row__label">Overall rating</span>
              <div className="gp-rating-bar-row__track">
                <div
                  className="gp-rating-bar-row__fill"
                  style={{ width: `${((summaryRating ?? 0) / 5) * 100}%` }}
                />
              </div>
              <span className="gp-rating-bar-row__score">{displayScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* No reviews yet state */}
      {data && reviewCount === 0 && !data.mine && (
        <div className="gp-reviews-empty">
          <ThumbsUp size={32} />
          <p>No reviews yet. Be the first to review this gym.</p>
        </div>
      )}

      {/* Must book to review */}
      {data && !data.canReview && !data.mine && (
        <p className="gp-reviews-gate">
          Book a pass at this gym to leave a review.
        </p>
      )}

      {/* Write / Edit Review Form */}
      {showForm && (
        <div className="gp-review-form-wrap">
          <h3 className="gp-review-form-title">
            {data?.mine ? 'Edit your review' : 'Share your experience'}
          </h3>
          <form className="gp-review-form" onSubmit={save}>
            {/* Star Picker */}
            <div className="gp-star-picker" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className={`gp-star-btn${n <= (hoverRating || rating) ? ' gp-star-btn--on' : ''}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star size={28} fill={n <= (hoverRating || rating) ? '#FFB703' : 'none'} color={n <= (hoverRating || rating) ? '#FFB703' : '#D0D5DD'} />
                </button>
              ))}
              {(hoverRating || rating) > 0 && (
                <span className="gp-star-label">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][hoverRating || rating]}
                </span>
              )}
            </div>

            <textarea
              className="gp-review-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What was the gym like? Equipment, cleanliness, staff…"
              aria-label="Your review"
            />

            {error && <p className="field-error" role="alert">{error}</p>}

            <div className="gp-review-form-actions">
              <button type="submit" className="gp-reserve-btn gp-reserve-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : data?.mine ? 'Update review' : 'Post review'}
              </button>
              {editing && (
                <button type="button" className="gp-text-link" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Your existing review actions */}
      {data?.mine?.hidden && !editing && (
        <p className="gp-reviews-gate">Your review is pending approval.</p>
      )}
      {data?.mine && !editing && (
        <div className="gp-review-mine-actions">
          <button type="button" className="gp-text-link" onClick={startEdit}>Edit your review</button>
          <button type="button" className="gp-text-link gp-text-link--danger" onClick={remove}>Delete</button>
        </div>
      )}

      {/* Review Cards */}
      {data && data.reviews.length > 0 && (
        <ul className="gp-review-list">
          {data.reviews.map(r => (
            <li key={r.id} className="gp-review-card">
              <div className="gp-review-card__head">
                <div className="gp-review-card__author-block">
                  <div className="gp-review-card__avatar">
                    {r.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="gp-review-card__author-info">
                    <strong className="gp-review-card__name">
                      {r.mine ? `${r.userName} (you)` : r.userName}
                    </strong>
                    <StarRow value={r.rating} size={14} />
                  </div>
                </div>
                <time className="gp-review-card__date" dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </time>
              </div>
              {r.body && <p className="gp-review-card__body">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
