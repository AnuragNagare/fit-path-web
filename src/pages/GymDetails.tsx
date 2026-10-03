import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Globe,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star,
  X,
} from 'lucide-react';
import { FEATURE_LABELS } from '@/data/features';
import { useApi } from '@/lib/api';
import { mockPrices, mockRating, mockReviews } from '@/lib/mock';
import { useDeal, useSavedGym, useStoredFeatures, type DealPlan } from '@/lib/useStoredQuery';
import type { Gym } from '@/types';

interface LocationState {
  gym?: Gym;
  nearby?: boolean; // the search had no destination, so distance is from the user
}

export default function GymDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gymId = '' } = useParams();
  const { getGym } = useApi();
  const state = location.state as LocationState | null;

  // The map page passes the gym along; fall back to fetching it (e.g. after a refresh).
  const [gym, setGym] = useState<Gym | null>(state?.gym && state.gym.id === gymId ? state.gym : null);
  const [loading, setLoading] = useState(!gym);

  useEffect(() => {
    if (gym || !gymId) return;
    let cancelled = false;
    getGym(gymId)
      .then(result => { if (!cancelled) setGym(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gym, gymId, getGym]);

  if (loading) {
    return (
      <main className="site gym-page">
        <div className="gym-not-found"><span className="auth-spinner" /></div>
      </main>
    );
  }

  if (!gym) {
    return (
      <main className="site gym-page">
        <div className="gym-not-found">
          <h1>Gym not found</h1>
          <p>It may have been removed from the map data. Search again to find gyms nearby.</p>
          <button className="pill-button gd-cta" onClick={() => navigate('/plan')}>Search gyms</button>
        </div>
      </main>
    );
  }

  return <GymProfile gym={gym} nearby={!!state?.nearby} />;
}

const PLANS: { id: DealPlan; label: string }[] = [
  { id: 'month', label: 'Monthly plan' },
  { id: 'day', label: 'Day pass' },
  { id: 'trial', label: 'Free trial' },
];

// Built from real map data only; OpenStreetMap has no gym descriptions.
function describe(gym: Gym, features: string[]): string {
  const parts = [`${gym.name} is a gym${gym.area ? ` in ${gym.area}` : ''}.`];
  if (gym.hours) parts.push(`Listed opening hours: ${gym.hours}.`);
  if (features.length > 0) parts.push(`Facilities listed on the map: ${features.join(', ')}.`);
  else parts.push('No facilities are listed for it on the map yet.');
  return parts.join(' ');
}

function GymProfile({ gym, nearby }: { gym: Gym; nearby: boolean }) {
  const navigate = useNavigate();
  const [saved, toggleSaved] = useSavedGym(gym.id);
  const [deal, setDeal] = useDeal(gym.id);
  const [selectedFeatures, setSelectedFeatures] = useStoredFeatures();
  const [plan, setPlan] = useState<DealPlan>(deal?.plan ?? 'month');
  const [showAllAbout, setShowAllAbout] = useState(false);
  const [shareNote, setShareNote] = useState('');

  // Open at the top, not at the scroll position carried over from the map page.
  useEffect(() => { window.scrollTo(0, 0); }, [gym.id]);

  const prices = mockPrices(gym.id);
  const featureLabels = gym.features.map(id => FEATURE_LABELS[id] ?? id);
  const starred = Array.from(selectedFeatures);
  const matched = starred.filter(id => gym.features.includes(id)).length;
  const about = describe(gym, featureLabels);
  const longAbout = about.length > 170;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lon}`;
  const website = gym.website && /^https?:\/\//.test(gym.website) ? gym.website : null;
  const planLabel = PLANS.find(p => p.id === plan)?.label ?? '';

  function removeStarred(id: string) {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function choosePlan(next: DealPlan) {
    setPlan(next);
    if (deal) setDeal({ ...deal, plan: next }); // keep a locked deal in step with the chosen plan
  }

  async function share() {
    const data = { title: gym.name, text: gym.address ?? gym.name, url: window.location.href };
    if (navigator.share) {
      await navigator.share(data).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(window.location.href);
    setShareNote('Link copied');
    setTimeout(() => setShareNote(''), 2000);
  }

  return (
    <main className="site gym-page">
      <header className="gd-header">
        <button className="gd-icon" onClick={() => navigate(-1)} aria-label="Back to results">
          <ArrowLeft size={22} />
        </button>
        <a className="brand" href="/" aria-label="Trace home">Tra<span>ce</span></a>
        <div className="gd-header-actions">
          {shareNote && <span className="gd-note" role="status">{shareNote}</span>}
          <button className="gd-icon" onClick={share} aria-label="Share gym">
            <Share2 size={20} />
          </button>
          <button className={`gd-icon${saved ? ' gd-icon--on' : ''}`} onClick={toggleSaved} aria-label={saved ? 'Remove from saved gyms' : 'Save gym'} aria-pressed={saved}>
            <Heart size={21} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </header>

      <div className="gd-shell">
        <section className="gd-hero" aria-label="Photos">
          <Dumbbell size={64} />
          <span>No photos yet</span>
        </section>

        <section className="gd-intro">
          <div className="gd-title-row">
            <h1>{gym.name}</h1>
            {gym.openNow !== null && (
              <span className={`gd-open${gym.openNow ? '' : ' gd-open--closed'}`}>{gym.openNow ? 'Open' : 'Closed'}</span>
            )}
          </div>
          <div className="gd-rating">
            <Star size={20} fill="currentColor" />
            <strong>{mockRating(gym.id)}</strong>
            <span>({mockReviews(gym.id)} reviews)</span>
            {gym.distanceKm > 0 && (
              <>
                <i aria-hidden="true" />
                <MapPin size={18} />
                <strong title={nearby ? 'From your location' : 'From your route'}>{gym.distanceKm} KM</strong>
              </>
            )}
          </div>
          <p className="gd-address"><MapPin size={17} fill="currentColor" /> {gym.address ?? (gym.area ? `${gym.area} (full address not listed)` : 'Address not listed')}</p>
          <a className="gd-directions" href={directionsUrl} target="_blank" rel="noreferrer">
            <Navigation size={16} /> Get Directions
          </a>
          {featureLabels.length > 0 && (
            <div className="gd-tags">
              {featureLabels.map(label => <span key={label}>{label}</span>)}
            </div>
          )}
        </section>

        <section className="gd-deal">
          <div className="gd-price">
            <strong>{prices.month}</strong><span>/mo</span>
            <small>Membership Plan</small>
          </div>
          <div className="gd-price-divider" />
          <div className="gd-price">
            <strong>{prices.day}</strong><span>/day</span>
            <small>Day Pass</small>
          </div>
          <div className="gd-deal-actions">
            <button
              type="button"
              className={`gd-lock${deal?.status === 'locked' ? ' gd-lock--done' : ''}`}
              onClick={() => setDeal({ plan, status: 'locked' })}
            >
              {deal?.status === 'locked' ? <><Check size={18} /> Deal locked</> : <>Lock this deal <ChevronRight size={20} /></>}
            </button>
            <button
              type="button"
              className={`gd-interest${deal?.status === 'interested' ? ' gd-interest--done' : ''}`}
              onClick={() => setDeal({ plan, status: 'interested' })}
            >
              <MessageCircle size={17} /> {deal?.status === 'interested' ? 'Interest shown' : 'Show interest'}
            </button>
          </div>
          {deal && (
            <p className="gd-deal-note">
              {deal.status === 'locked' ? `${planLabel} locked` : `Interest shown in the ${planLabel.toLowerCase()}`}. Saved on this device; the gym isn't contacted yet.
              <button type="button" onClick={() => setDeal(null)}>Undo</button>
            </p>
          )}
        </section>

        <section className="gd-card gd-musthaves">
          <div className="gd-row">
            <h2>Your must-haves <b>{starred.length}</b></h2>
            <button type="button" className="gd-link" onClick={() => navigate('/map')}>
              {starred.length > 0 ? 'Compare on map' : 'Pick features'}
            </button>
          </div>
          <div className="gd-meter" role="img" aria-label={`${matched} of ${starred.length} must-haves listed`}>
            <span style={{ width: starred.length ? `${(matched / starred.length) * 100}%` : '0%' }} />
          </div>
          <p>
            {starred.length > 0
              ? `${matched} of ${starred.length} must-haves are listed for this gym.`
              : 'Star what matters on the map page, and we’ll match it across gyms.'}
          </p>
        </section>

        {starred.length > 0 && (
          <section className="gd-section">
            <div className="gd-row">
              <h2>Features you starred ({starred.length})</h2>
              <button type="button" className="gd-link" onClick={() => navigate('/map')}>Edit</button>
            </div>
            <div className="gd-chips">
              {starred.map(id => {
                const has = gym.features.includes(id);
                return (
                  <span key={id} className={has ? '' : 'gd-chip-miss'} title={has ? 'Listed for this gym' : 'Not listed for this gym'}>
                    {FEATURE_LABELS[id] ?? id}
                    <button type="button" onClick={() => removeStarred(id)} aria-label={`Remove ${FEATURE_LABELS[id] ?? id}`}>
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          </section>
        )}

        <section className="gd-section">
          <h2>About {gym.name}</h2>
          <p className="gd-about">{showAllAbout || !longAbout ? about : `${about.slice(0, 170).trimEnd()}…`}</p>
          {longAbout && (
            <button type="button" className="gd-link" onClick={() => setShowAllAbout(v => !v)}>
              {showAllAbout ? 'Show less' : 'Read more'} <ChevronDown size={16} className={showAllAbout ? 'gd-flip' : ''} />
            </button>
          )}
        </section>

        <section className="gd-section">
          <h2>Deal options</h2>
          <div className="gd-options" role="radiogroup" aria-label="Deal options">
            {PLANS.map(p => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={plan === p.id}
                className={`gd-option${plan === p.id ? ' gd-option--on' : ''}`}
                onClick={() => choosePlan(p.id)}
              >
                <strong>
                  {p.id === 'month' ? <>{prices.month}<small>/mo</small></> : p.id === 'day' ? <>{prices.day}<small>/day</small></> : 'Free Trial'}
                </strong>
                <span>{p.id === 'trial' ? '1 Day Pass' : p.label}</span>
                {p.id === 'month' ? <b>Most Popular</b> : <em>{p.id === 'day' ? 'No commitment' : 'For new users'}</em>}
              </button>
            ))}
          </div>
        </section>

        <section className="gd-section">
          <h2>Gym info</h2>
          <dl className="gd-info">
            <div><dt>Opening hours</dt><dd>{gym.hours ?? 'Not listed'}</dd></div>
            {gym.phone && <div><dt>Phone</dt><dd><a href={`tel:${gym.phone}`}><Phone size={14} /> {gym.phone}</a></dd></div>}
            {website && <div><dt>Website</dt><dd><a href={website} target="_blank" rel="noreferrer"><Globe size={14} /> Visit website</a></dd></div>}
            {gym.distanceKm > 0 && <div><dt>{nearby ? 'From your location' : 'From your route'}</dt><dd>{gym.distanceKm} km</dd></div>}
          </dl>
        </section>

        <p className="gd-mock-note">Ratings, reviews and prices are sample values until real gym data is connected.</p>
      </div>
    </main>
  );
}
