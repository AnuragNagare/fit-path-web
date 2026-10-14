import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { Booking, Gym, Plan } from '@/types';
import { useApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { formatDateRange, PLAN_LABELS, PLANS } from '@/lib/plans';

// Booking is reserve-only for now: the user picks a plan and the number of people, the dates start
// today automatically, and payment happens at the gym.
export default function BookingPanel({ gym }: { gym: Gym }) {
  const { bookings } = useApi();
  const { format } = useCurrency();
  const [plan, setPlan] = useState<Plan>(gym.bookable[0] ?? 'month');
  const [people, setPeople] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booking | null>(null);

  const canBook = gym.bookable.includes(plan);

  async function book() {
    setSubmitting(true);
    setError('');
    try {
      setBooked(await bookings.create(gym.id, plan, people));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    return (
      <section className="gd-section gd-book" aria-live="polite">
        <div className="book-done">
          <span className="book-done-icon"><Check size={22} /></span>
          <div>
            <h2>Booked: {PLAN_LABELS[booked.plan]}</h2>
            <p>{formatDateRange(booked.startDate, booked.endDate)} · {booked.people} {booked.people === 1 ? 'person' : 'people'}</p>
            <p><strong>{format(booked.amountInr)}</strong> to pay at the gym.</p>
            <Link className="gd-link" to="/bookings">View my bookings</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="gd-section gd-book">
      <h2>Book this gym</h2>
      <div className="gd-options" role="radiogroup" aria-label="Membership plan">
        {PLANS.map(p => {
          const available = gym.bookable.includes(p);
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={plan === p}
              className={`gd-option${plan === p ? ' gd-option--on' : ''}${available ? '' : ' gd-option--sample'}`}
              onClick={() => setPlan(p)}
            >
              <strong>{format(gym.prices[p])}</strong>
              <span>{PLAN_LABELS[p]}</span>
              <em>{available ? 'per person' : 'sample price'}</em>
            </button>
          );
        })}
      </div>

      {gym.bookable.length === 0 ? (
        <p className="book-note">Booking opens when this gym sets its prices. The prices above are samples.</p>
      ) : (
        <>
          <div className="book-row">
            <span id="book-people">People</span>
            <div className="people-counter book-counter" role="group" aria-labelledby="book-people">
              <button type="button" className="counter-btn" onClick={() => setPeople(n => Math.max(1, n - 1))} disabled={people <= 1} aria-label="Fewer people">−</button>
              <span className="counter-value">{people}</span>
              <button type="button" className="counter-btn" onClick={() => setPeople(n => Math.min(99, n + 1))} aria-label="More people">+</button>
            </div>
          </div>
          <p className="book-note">Starts today. Pay at the gym, nothing is charged now.</p>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="button" className="pill-button book-submit" onClick={book} disabled={!canBook || submitting}>
            {submitting ? 'Booking…' : canBook ? `Book ${PLAN_LABELS[plan].toLowerCase()} · ${format(gym.prices[plan] * people)}` : 'Not available yet'}
          </button>
        </>
      )}
    </section>
  );
}
