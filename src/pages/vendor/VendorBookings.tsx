import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { formatDateRange, PLAN_LABELS } from '@/lib/plans';
import type { VendorBooking } from '@/types';
import { formatDateTime, inr } from '../admin/format';

// Read-only. Customer contact details are not shown to gym owners.
export default function VendorBookings() {
  const { vendor } = useApi();
  const [list, setList] = useState<VendorBooking[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    vendor.bookings()
      .then(result => { if (!cancelled) setList(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load bookings."); });
    return () => { cancelled = true; };
  }, [vendor]);

  return (
    <>
      <h1 className="admin-title">Bookings</h1>
      <p className="muted">People who booked your gym. Payment is collected at the gym.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {!list && !error && <p className="listing-empty">Loading…</p>}
      {list?.length === 0 && <p className="listing-empty">No bookings yet.</p>}
      {list && list.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Plan</th><th>Dates</th><th>People</th><th>Amount</th><th>Payment</th><th>Status</th><th>Booked</th></tr>
            </thead>
            <tbody>
              {list.map(b => (
                <tr key={b.id}>
                  <td><strong>{b.userName}</strong></td>
                  <td>{PLAN_LABELS[b.plan]}</td>
                  <td>{formatDateRange(b.startDate, b.endDate)}</td>
                  <td>{b.people}</td>
                  <td>{inr(b.amountInr)}</td>
                  <td>{b.paymentStatus === 'paid' ? 'Paid' : b.paymentStatus === 'refunded' ? 'Refunded' : 'Due'}</td>
                  <td>{b.status === 'cancelled' ? 'Cancelled' : 'Booked'}</td>
                  <td className="muted">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
