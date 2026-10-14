import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useApi } from '@/lib/api';

type Data = Awaited<ReturnType<ReturnType<typeof useApi>['vendor']['reviews']>>;

// Read-only. Only FitPath can edit, hide or remove reviews and ratings.
export default function VendorReviews() {
  const { vendor } = useApi();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    vendor.reviews()
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load reviews."); });
    return () => { cancelled = true; };
  }, [vendor]);

  return (
    <>
      <h1 className="admin-title">Reviews</h1>
      <p className="muted">What customers say about your gym. Reviews and ratings can't be changed by gym owners.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {!data && !error && <p className="listing-empty">Loading…</p>}
      {data && (
        <div className="admin-cards">
          <div><strong>{data.summary.rating ?? '–'}</strong><span>Average rating</span></div>
          <div><strong>{data.summary.reviewCount}</strong><span>{data.summary.reviewCount === 1 ? 'Review' : 'Reviews'}</span></div>
        </div>
      )}
      {data?.reviews.length === 0 && <p className="listing-empty">No reviews yet.</p>}
      <ul className="admin-reviews">
        {data?.reviews.map(r => (
          <li key={r.id}>
            <div className="admin-review-head">
              <strong>{r.userName}</strong>
              <span className="stars" role="img" aria-label={`${r.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={15} fill={n <= r.rating ? 'currentColor' : 'none'} />)}
              </span>
              <time className="muted" dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
            </div>
            {r.body && <p>{r.body}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
