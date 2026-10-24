import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { Booking, Gym, Plan } from '@/types';
import { useApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { formatDateRange, PLAN_LABELS, PLANS } from '@/lib/plans';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

const PLAN_DESCRIPTIONS: Record<Plan, string> = {
  day: 'Full day entry · Access to all facilities',
  week: '7 consecutive days · Access to all facilities',
  month: '30 days · Access to all facilities',
  quarter: '90 days · Best value for regulars',
  half: '6 months · Long-term savings',
  year: '12 months · Maximum savings',
};

const PLAN_INCLUSIONS = [
  'Access to all listed facilities',
  'Starts today automatically',
  'Pay at the gym — nothing charged now',
  'Instant confirmation',
];

function getSelectedPlanInclusions(plan: Plan): string[] {
  const base = [...PLAN_INCLUSIONS];
  if (plan === 'day') base.splice(2, 0, 'Full day entry');
  if (plan === 'year' || plan === 'half') base.push('Priority access during peak hours');
  return base;
}

interface PassTableProps {
  gym: Gym;
}

export default function BookingPanel({ gym }: PassTableProps) {
  const { bookings } = useApi();
  const { format } = useCurrency();
  const [selectedPlan, setSelectedPlan] = useState<Plan>(gym.bookable[0] ?? 'month');
  const [people, setPeople] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booking | null>(null);

  async function book() {
    setSubmitting(true);
    setError('');
    try {
      setBooked(await bookings.create(gym.id, selectedPlan, people));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    return (
      <section className="gp-section" id="availability" aria-live="polite">
        <h2 className="gp-section-title">Availability</h2>
        <div className="gp-book-success">
          <div className="gp-book-success__icon">
            <Check size={28} />
          </div>
          <div className="gp-book-success__body">
            <h3>Booking confirmed!</h3>
            <p>
              <strong>{PLAN_LABELS[booked.plan]}</strong> ·{' '}
              {formatDateRange(booked.startDate, booked.endDate)}
            </p>
            <p>
              {booked.people} {booked.people === 1 ? 'person' : 'people'} ·{' '}
              <strong>{format(booked.amountInr)}</strong> to pay at the gym
            </p>
            <Link className="gp-text-link" to="/bookings">
              View my bookings →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const isSampleOnly = gym.bookable.length === 0;

  return (
    <section className="gp-section" id="availability">
      <h2 className="gp-section-title">Availability</h2>

      {isSampleOnly && (
        <div className="gp-sample-notice">
          Pricing not confirmed yet by this gym. Prices shown are estimates only and cannot be
          booked.
        </div>
      )}

      {/* Pass Table */}
      <div className="gp-pass-table">
        {/* Table Header */}
        <div className="gp-pass-table__header">
          <div className="gp-pass-table__col gp-pass-table__col--plan">Pass / Membership</div>
          <div className="gp-pass-table__col gp-pass-table__col--guests">Guests</div>
          <div className="gp-pass-table__col gp-pass-table__col--price">Price</div>
          <div className="gp-pass-table__col gp-pass-table__col--includes">What's Included</div>
          <div className="gp-pass-table__col gp-pass-table__col--action">Select</div>
        </div>

        {/* Plan Rows */}
        {PLANS.map(plan => {
          const isBookable = gym.bookable.includes(plan);
          const isSelected = selectedPlan === plan;
          const price = gym.prices[plan];
          const samplePrice = Math.round(price * 1.3);
          const inclusions = getSelectedPlanInclusions(plan);

          return (
            <div
              key={plan}
              className={`gp-pass-row${isSelected ? ' gp-pass-row--selected' : ''}`}
              onClick={() => setSelectedPlan(plan)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSelectedPlan(plan)}
              aria-selected={isSelected}
            >
              {/* Plan Name */}
              <div className="gp-pass-row__plan">
                <strong className="gp-pass-row__plan-name">{PLAN_LABELS[plan]}</strong>
                <span className="gp-pass-row__plan-desc">{PLAN_DESCRIPTIONS[plan]}</span>
                {!isBookable && (
                  <span className="gp-pass-row__sample-badge">Sample price</span>
                )}
              </div>

              {/* Guests */}
              <div className="gp-pass-row__guests">
                <Users size={16} />
                <span>{people}</span>
              </div>

              {/* Price */}
              <div className="gp-pass-row__price">
                {isBookable ? (
                  <>
                    <span className="gp-pass-row__orig-price">{format(samplePrice)}</span>
                    <strong className="gp-pass-row__main-price">{format(price)}</strong>
                  </>
                ) : (
                  <>
                    <strong className="gp-pass-row__main-price gp-pass-row__main-price--sample">
                      {format(price)}
                    </strong>
                  </>
                )}
                <span className="gp-pass-row__per">per person</span>
              </div>

              {/* Inclusions */}
              <div className="gp-pass-row__includes">
                {inclusions.map(item => (
                  <span key={item} className="gp-pass-row__inclusion">
                    <Check size={12} className="gp-pass-row__check" />
                    {item}
                  </span>
                ))}
              </div>

              {/* Action */}
              <div className="gp-pass-row__action" onClick={e => e.stopPropagation()}>
                {/* People Counter */}
                {isSelected && !isSampleOnly && (
                  <div className="gp-people-counter">
                    <button
                      type="button"
                      className="gp-counter-btn"
                      onClick={() => setPeople(n => Math.max(1, n - 1))}
                      disabled={people <= 1}
                      aria-label="Fewer people"
                    >
                      −
                    </button>
                    <span className="gp-counter-val">{people}</span>
                    <button
                      type="button"
                      className="gp-counter-btn"
                      onClick={() => setPeople(n => Math.min(99, n + 1))}
                      aria-label="More people"
                    >
                      +
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className={`gp-reserve-btn${isSelected ? ' gp-reserve-btn--primary' : ' gp-reserve-btn--ghost'}`}
                  onClick={() => {
                    setSelectedPlan(plan);
                    if (isSelected && !isSampleOnly) void book();
                  }}
                  disabled={isSampleOnly || (isSelected && submitting)}
                  aria-label={`Book ${PLAN_LABELS[plan]}`}
                >
                  {isSelected ? (
                    submitting ? (
                      'Booking…'
                    ) : isSampleOnly ? (
                      'Unavailable'
                    ) : (
                      <>
                        Book this pass <ChevronRight size={14} />
                      </>
                    )
                  ) : (
                    'Select'
                  )}
                </button>

                {isSelected && !isSampleOnly && (
                  <p className="gp-reserve-note">Won't be charged now</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="field-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </section>
  );
}
