import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/api';
import type { Gym } from '@/types';
import { formatDateTime } from './format';

type EditedGym = { id: string; name: string | null; hidden: boolean; updated_at: string; images: number; bookings: number };

export default function AdminGyms() {
  const { admin, geocode, searchGyms } = useApi();
  const [edited, setEdited] = useState<EditedGym[] | null>(null);
  const [area, setArea] = useState('');
  const [results, setResults] = useState<Gym[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    admin.get<{ gyms: EditedGym[] }>('gyms')
      .then(r => { if (!cancelled) setEdited(r.gyms); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load gyms."); });
    return () => { cancelled = true; };
  }, [admin]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!area.trim()) return;
    setSearching(true);
    setError('');
    try {
      const place = await geocode(area.trim());
      setResults((await searchGyms({ place, people: 1 })).gyms);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : "Couldn't search that area.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <h1 className="admin-title">Gyms</h1>
      {error && <p className="field-error" role="alert">{error}</p>}

      <section className="admin-section">
        <h2>Find a gym to edit</h2>
        <form className="admin-search" onSubmit={search}>
          <input type="search" value={area} onChange={e => setArea(e.target.value)} placeholder="Area or city, e.g. Bandra, Mumbai" aria-label="Area or city" />
          <button type="submit" className="pill-button compact" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>
        {results && results.length === 0 && <p className="listing-empty">No gyms found there.</p>}
        <ul className="admin-gym-list">
          {results?.map(g => (
            <li key={g.id}>
              <Link to={`/admin/gyms/${g.id}`}>
                <strong>{g.name}</strong>
                <span className="muted">{g.area ?? 'Area not listed'} · {g.distanceKm} km</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="muted">Gyms an admin has hidden don't appear in search. Find them in the list below.</p>
      </section>

      <section className="admin-section">
        <h2>Gyms you have edited</h2>
        {!edited && !error && <p className="listing-empty">Loading…</p>}
        {edited?.length === 0 && <p className="listing-empty">Nothing edited yet. Search for a gym above.</p>}
        <ul className="admin-gym-list">
          {edited?.map(g => (
            <li key={g.id}>
              <Link to={`/admin/gyms/${g.id}`}>
                <strong>{g.name ?? g.id}</strong>
                <span className="muted">
                  {g.hidden && 'Hidden · '}{g.images} {g.images === 1 ? 'photo' : 'photos'} · {g.bookings} {g.bookings === 1 ? 'booking' : 'bookings'} · edited {formatDateTime(g.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
