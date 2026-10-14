import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { ArrowRight, MapPin, Users } from 'lucide-react';
import type { Place, SearchQuery } from '@/types';
import { useApi } from '@/lib/api';

interface Props {
  initial: SearchQuery | null; // the saved search, so "Edit" starts from it
  onSearch: (query: SearchQuery) => void;
}

const MY_LOCATION = 'My location';

function getMyLocation(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("Location isn't supported in this browser. Type an area instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ label: MY_LOCATION, lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error("Couldn't get your location. Allow location access, or type an area.")),
      { timeout: 10000 },
    );
  });
}

export default function SearchPage({ initial, onSearch }: Props) {
  const navigate = useNavigate();
  const { geocode } = useApi();

  // An empty box means "use my location", so a saved location search starts empty again.
  const savedPlace = initial && initial.place.label !== MY_LOCATION ? initial.place : null;
  const [where, setWhere] = useState(savedPlace?.label ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [people, setPeople] = useState(initial?.people ?? 1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const typed = where.trim();
      const place = !typed
        ? await getMyLocation()
        : savedPlace && typed === savedPlace.label ? savedPlace : await geocode(typed);
      onSearch({ place, people });
      navigate('/map');
    } catch (err) {
      setErrors({ where: err instanceof Error ? err.message : "Couldn't find that place." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site">
      <div className="page-corner">
        <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
        <UserButton />
      </div>

      <div className="plan-page">
        <div className="plan-inner">
          <p className="eyebrow">Find a gym</p>
          <h2 className="plan-title">Where do you want to work out?</h2>
          <p className="plan-sub">Type an area or city, or leave it empty to see gyms within 10 km of where you are.</p>

          <form className="plan-form" onSubmit={handleSubmit} noValidate>
            {/* Where */}
            <div className={`plan-field${errors.where ? ' has-error' : ''}`}>
              <label htmlFor="where">
                <MapPin size={18} className="field-icon" />
                Area or city
              </label>
              <input
                id="where"
                type="text"
                placeholder="e.g. Bandra, Mumbai. Leave empty to use your location"
                value={where}
                onChange={e => setWhere(e.target.value)}
                autoComplete="off"
              />
              {errors.where && <span className="field-error">{errors.where}</span>}
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
              {submitting ? 'Finding gyms…' : where.trim() ? 'Find gyms' : 'Find gyms near me'} <ArrowRight size={22} strokeWidth={3} />
            </button>
          </form>
        </div>

        {/* decorative line */}
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
