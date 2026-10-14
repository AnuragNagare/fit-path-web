import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { formatDateRange, PLAN_LABELS } from '@/lib/plans';
import type { Booking } from '@/types';
import { formatDateTime, inr } from './format';
import Pager from './Pager';

type AdminBooking = Booking & { userName: string; userEmail: string };
type Stats = {
  bookings: { total: number; active: number; cancelled: number; newToday: number };
  amountDueInr: number;
  amountPaidInr: number;
  reviews: number;
  editedGyms: number;
};
type Filters = { q: string; gym: string; status: string; from: string; to: string };
const NO_FILTERS: Filters = { q: '', gym: '', status: '', from: '', to: '' };

export default function AdminBookings() {
  const { admin } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ bookings: AdminBooking[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState('');

  const loadStats = useCallback(() => {
    admin.get<Stats>('stats').then(setStats).catch(err => setError(err instanceof Error ? err.message : "Couldn't load the numbers."));
  }, [admin]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    let cancelled = false;
    admin
      .get<{ bookings: AdminBooking[]; total: number; pageSize: number }>('bookings', { ...applied, page })
      .then(result => { if (!cancelled) { setData(result); setError(''); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load bookings."); });
    return () => { cancelled = true; };
  }, [admin, applied, page]);

  async function change(id: string, patch: { status?: string; paymentStatus?: string }) {
    try {
      const { booking } = await admin.patch<{ booking: AdminBooking }>('bookings', { id, ...patch });
      setData(d => d && { ...d, bookings: d.bookings.map(b => (b.id === id ? booking : b)) });
      loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the booking.");
    }
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied(form);
  }

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <h1 className="admin-title">Bookings</h1>

      {stats && (
        <div className="admin-cards">
          <div><strong>{stats.bookings.active}</strong><span>Active bookings</span></div>
          <div><strong>{stats.bookings.newToday}</strong><span>Booked today</span></div>
          <div><strong>{inr(stats.amountDueInr)}</strong><span>To collect at gyms</span></div>
          <div><strong>{inr(stats.amountPaidInr)}</strong><span>Marked paid</span></div>
          <div><strong>{stats.bookings.total}</strong><span>All bookings ({stats.bookings.cancelled} cancelled)</span></div>
        </div>
      )}

      <form className="admin-filters" onSubmit={search}>
        <label>Person<input type="search" value={form.q} onChange={set('q')} placeholder="Name or email" /></label>
        <label>Gym<input type="search" value={form.gym} onChange={set('gym')} placeholder="Gym name" /></label>
        <label>Status
          <select value={form.status} onChange={set('status')}>
            <option value="">All</option>
            <option value="booked">Booked</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>Starts from<input type="date" value={form.from} onChange={set('from')} /></label>
        <label>Starts to<input type="date" value={form.to} onChange={set('to')} /></label>
        <div className="admin-filter-actions">
          <button type="submit" className="pill-button compact">Search</button>
          <button type="button" className="gd-link" onClick={() => { setForm(NO_FILTERS); setApplied(NO_FILTERS); setPage(1); }}>Clear</button>
        </div>
      </form>

      {error && <p className="field-error" role="alert">{error}</p>}
      {!data && !error && <p className="listing-empty">Loading…</p>}
      {data && data.bookings.length === 0 && <p className="listing-empty">No bookings match.</p>}

      {data && data.bookings.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Person</th><th>Gym</th><th>Plan</th><th>Dates</th><th>People</th><th>Amount</th><th>Payment</th><th>Status</th><th>Booked</th></tr>
            </thead>
            <tbody>
              {data.bookings.map(b => (
                <tr key={b.id}>
                  <td><strong>{b.userName}</strong><br /><span className="muted">{b.userEmail}</span></td>
                  <td>{b.gymName}</td>
                  <td>{PLAN_LABELS[b.plan]}</td>
                  <td>{formatDateRange(b.startDate, b.endDate)}</td>
                  <td>{b.people}</td>
                  <td>{inr(b.amountInr)}</td>
                  <td>
                    <select value={b.paymentStatus} onChange={e => change(b.id, { paymentStatus: e.target.value })} aria-label={`Payment for ${b.userName}`}>
                      <option value="due">Due</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </td>
                  <td>
                    <select value={b.status} onChange={e => change(b.id, { status: e.target.value })} aria-label={`Status of ${b.userName}'s booking`}>
                      <option value="booked">Booked</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="muted">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </>
  );
}
