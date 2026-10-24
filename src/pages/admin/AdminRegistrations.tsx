import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/api';
import type { VendorState } from '@/types';
import { formatDateTime } from './format';
import { STATE_LABEL, STATE_TONE } from './states';

type Row = {
  id: string;
  name: string | null;
  ownerName: string;
  ownerEmail: string;
  state: VendorState;
  tier?: 'free' | 'paid';
  tierRequestedAt?: string | null;
  firstSubmission: boolean;
  submittedAt: string | null;
  updatedAt: string;
};

export default function AdminRegistrations() {
  const { admin } = useApi();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [gyms, setGyms] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    admin.get<{ gyms: Row[] }>('registrations', { filter })
      .then(r => { if (!cancelled) { setGyms(r.gyms); setError(''); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load registrations."); });
    return () => { cancelled = true; };
  }, [admin, filter]);

  return (
    <>
      <h1 className="admin-title">Gym registrations</h1>
      <div className="admin-tabs" role="tablist" aria-label="Show">
        <button type="button" role="tab" aria-selected={filter === 'pending'} className={filter === 'pending' ? 'on' : ''} onClick={() => { setGyms(null); setFilter('pending'); }}>Waiting for approval</button>
        <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => { setGyms(null); setFilter('all'); }}>All gyms</button>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {!gyms && !error && <p className="listing-empty">Loading…</p>}
      {gyms?.length === 0 && <p className="listing-empty">{filter === 'pending' ? 'Nothing is waiting for approval.' : 'No gyms have registered yet. Create a link on the Links page.'}</p>}

      <ul className="admin-gym-list">
        {gyms?.map(g => (
          <li key={g.id} className={g.tier === 'paid' ? 'admin-gym-item--paid' : ''}>
            <Link to={`/admin/registrations/${g.id}`}>
              <div className="admin-gym-header">
                <strong>{g.name ?? 'Unnamed gym'}</strong>
                {g.tier === 'paid' && (
                  <span className="status-badge status-badge--paid">★ ₹15,000 Paid Setup</span>
                )}
              </div>
              <span className="muted">
                {g.ownerName} · {g.ownerEmail}
                {g.submittedAt ? ` · submitted ${formatDateTime(g.submittedAt)}` : ` · updated ${formatDateTime(g.updatedAt)}`}
              </span>
              <span className={`status-badge status-badge--${STATE_TONE[g.state]}`}>{STATE_LABEL[g.state]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
