import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { ArrowRight, Calendar, LocateFixed, MapPin, Users } from 'lucide-react';
import type { Place, RouteQuery } from '@/types';
import { useApi } from '@/lib/api';

interface Props {
  initial: RouteQuery | null; // the saved search, so "Edit" starts from it
  onSearch: (query: RouteQuery) => void;
}

export default function RoutePlanner({ initial, onSearch }: Props) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { geocode } = useApi();

  const [from, setFrom] = useState(initial?.from.label ?? '');
  const [fromPlace, setFromPlace] = useState<Place | null>(initial?.from ?? null);
  const [locating, setLocating] = useState(false);
  const [to, setTo] = useState(initial?.to?.label ?? '');
  const toPlace = initial?.to ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [people, setPeople] = useState(initial?.people ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!from.trim()) e.from = 'Allow location access, or type a starting point';
    if (!startDate) e.startDate = 'Pick a start date';
    if (!endDate) e.endDate = 'Pick an end date';
    if (startDate && endDate && endDate < startDate) e.endDate = 'End date must be after start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // `keepTyped`: the automatic request on arrival must not replace a place the user already typed.
  function fillMyLocation(keepTyped = false) {
    if (!('geolocation' in navigator)) {
      setErrors(prev => ({ ...prev, from: "Location isn't supported in this browser" }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFromPlace({ label: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude });
        setFrom(prev => (keepTyped && prev.trim() ? prev : 'My location'));
        setErrors(prev => ({ ...prev, from: '' }));
        setLocating(false);
      },
      () => {
        if (!keepTyped) setErrors(prev => ({ ...prev, from: "Couldn't get your location. Type a place instead." }));
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }

  // Ask for the user's location once on arrival so "From" is ready without typing.
  const askedForLocation = useRef(false);
  useEffect(() => {
    if (askedForLocation.current) return;
    askedForLocation.current = true;
    fillMyLocation(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const [fromResolved, toResolved] = await Promise.all([
        fromPlace && from === fromPlace.label ? fromPlace : geocode(from.trim()),
        !to.trim() ? Promise.resolve(null) : toPlace && to === toPlace.label ? toPlace : geocode(to.trim()),
      ]);
      onSearch({ from: fromResolved, to: toResolved, startDate, endDate, people });
      navigate('/map');
    } catch (err) {
      setErrors({ [to.trim() ? 'to' : 'from']: err instanceof Error ? err.message : "Couldn't find that place." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site">
      <div className="page-corner">
        <a className="brand" href="/" aria-label="Trace home">Tra<span>ce</span></a>
        <UserButton />
      </div>

      <div className="plan-page">
        <div className="plan-inner">
          <p className="eyebrow">Plan your route</p>
          <h2 className="plan-title">Where are you headed?</h2>
          <p className="plan-sub">Add a destination to see gyms along the road, or leave it empty to see gyms within 3 km.</p>

          <form className="plan-form" onSubmit={handleSubmit} noValidate>
            {/* From */}
            <div className={`plan-field${errors.from ? ' has-error' : ''}`}>
              <label htmlFor="from">
                <MapPin size={18} className="field-icon" />
                From
              </label>
              <input
                id="from"
                type="text"
                placeholder="e.g. Connaught Place, Delhi"
                value={from}
                onChange={e => setFrom(e.target.value)}
                autoComplete="off"
              />
              <button type="button" className="text-link" onClick={() => fillMyLocation()} disabled={locating}>
                <LocateFixed size={16} /> {locating ? 'Locating…' : 'Use my location'}
              </button>
              {errors.from && <span className="field-error">{errors.from}</span>}
            </div>

            {/* To */}
            <div className={`plan-field${errors.to ? ' has-error' : ''}`}>
              <label htmlFor="to">
                <MapPin size={18} className="field-icon" />
                To <span className="field-optional">(optional)</span>
              </label>
              <input
                id="to"
                type="text"
                placeholder="Leave empty to see gyms within 3 km"
                value={to}
                onChange={e => setTo(e.target.value)}
                autoComplete="off"
              />
              {errors.to && <span className="field-error">{errors.to}</span>}
            </div>

            {/* Dates */}
            <div className="plan-dates">
              <div className={`plan-field${errors.startDate ? ' has-error' : ''}`}>
                <label htmlFor="startDate">
                  <Calendar size={18} className="field-icon" />
                  Start date
                </label>
                <input
                  id="startDate"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
                {errors.startDate && <span className="field-error">{errors.startDate}</span>}
              </div>
              <div className={`plan-field${errors.endDate ? ' has-error' : ''}`}>
                <label htmlFor="endDate">
                  <Calendar size={18} className="field-icon" />
                  End date
                </label>
                <input
                  id="endDate"
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
                {errors.endDate && <span className="field-error">{errors.endDate}</span>}
              </div>
            </div>

            {/* People */}
            <div className="plan-field">
              <label htmlFor="people">
                <Users size={18} className="field-icon" />
                Number of people
              </label>
              <div className="people-counter">
                <button
                  type="button"
                  className="counter-btn"
                  onClick={() => setPeople(p => Math.max(1, p - 1))}
                  aria-label="Decrease"
                  disabled={people <= 1}
                >−</button>
                <span id="people" className="counter-value">{people}</span>
                <button
                  type="button"
                  className="counter-btn"
                  onClick={() => setPeople(p => Math.min(99, p + 1))}
                  aria-label="Increase"
                >+</button>
              </div>
            </div>

            <button type="submit" className="pill-button plan-submit" disabled={submitting}>
              {submitting ? 'Finding places…' : to.trim() ? 'Find gyms on my route' : 'Find gyms near me'} <ArrowRight size={22} strokeWidth={3} />
            </button>
          </form>
        </div>

        {/* decorative route line */}
        <svg className="plan-bg-line" viewBox="0 0 900 500" fill="none" aria-hidden="true">
          <path d="M-20 400 C120 370 160 200 300 180 C440 160 420 300 560 270 C700 240 740 110 920 80"
            stroke="currentColor" strokeWidth="2.5" strokeDasharray="14 16" />
          <circle cx="300" cy="180" r="9" fill="currentColor" />
          <circle cx="560" cy="270" r="9" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
