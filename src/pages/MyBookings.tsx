import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { ArrowLeft } from 'lucide-react';
import type { Booking } from '@/types';
import { useApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { formatDateRange, PLAN_LABELS } from '@/lib/plans';
import CurrencyPicker from '@/components/CurrencyPicker';

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function statusOf(b: Booking): { label: string; tone: 'active' | 'ended' | 'cancelled' } {
  if (b.status === 'cancelled') return { label: 'Cancelled', tone: 'cancelled' };
  return b.endDate >= todayIso() ? { label: 'Active', tone: 'active' } : { label: 'Ended', tone: 'ended' };
}

export default function MyBookings() {
  const navigate = useNavigate();
  const { bookings } = useApi();
  const { format } = useCurrency();
  const [list, setList] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await bookings.list());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your bookings.");
    }
  }, [bookings]);

  useEffect(() => { void load(); }, [load]);

  async function cancel(id: string) {
    setBusyId(id);
    setError('');
    try {
      await bookings.cancel(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel this booking.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="site gym-page">
      <header className="gd-header">
        <button className="gd-icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
        <div className="gd-header-actions">
          <CurrencyPicker />
          <UserButton />
        </div>
      </header>

      <div className="gd-shell">
        <h1 className="page-title">My bookings</h1>
        {error && <p className="field-error" role="alert">{error}</p>}
        {list === null && !error && <p className="listing-empty">Loading…</p>}
        {list?.length === 0 && (
          <p className="listing-empty">You haven't booked a gym yet. <Link className="gd-link" to="/plan">Find a gym</Link></p>
        )}

        <ul className="booking-list">
          {list?.map(b => {
            const status = statusOf(b);
            return (
              <li key={b.id} className="booking-card">
                <div className="booking-main">
                  <Link to={`/gym/${b.gymId}`} className="booking-gym">{b.gymName}</Link>
                  <span className={`status-badge status-badge--${status.tone}`}>{status.label}</span>
                </div>
                <p className="booking-meta">{PLAN_LABELS[b.plan]} · {formatDateRange(b.startDate, b.endDate)} · {b.people} {b.people === 1 ? 'person' : 'people'}</p>
                <p className="booking-amount">
                  <strong>{format(b.amountInr)}</strong>
                  <span>{b.paymentStatus === 'paid' ? 'Paid' : b.paymentStatus === 'refunded' ? 'Refunded' : b.status === 'cancelled' ? 'Nothing to pay' : 'Pay at the gym'}</span>
                </p>
                {status.tone === 'active' && (
                  <button type="button" className="gd-link" onClick={() => cancel(b.id)} disabled={busyId === b.id}>
                    {busyId === b.id ? 'Cancelling…' : 'Cancel booking'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
