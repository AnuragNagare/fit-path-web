import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Dumbbell,
  Globe,
  Heart,
  Lock,
  MapPin,
  Navigation,
  ParkingCircle,
  Phone,
  Share2,
  ShowerHead,
  Star,
  Waves,
  Wind,
  X,
  ZoomIn,
} from 'lucide-react';
import { FEATURE_CATEGORIES, FEATURE_LABELS } from '@/data/features';
import { useApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { useSavedGym, useStoredFeatures } from '@/lib/useStoredQuery';
import type { Gym } from '@/types';
import BookingPanel from '@/components/BookingPanel';
import CurrencyPicker from '@/components/CurrencyPicker';
import Reviews from '@/components/Reviews';

interface LocationState {
  gym?: Gym;
}

// ── LOADING / NOT-FOUND STATES ───────────────────────────────────────────────

export default function GymDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gymId = '' } = useParams();
  const { getGym } = useApi();
  const state = location.state as LocationState | null;

  const [gym, setGym] = useState<Gym | null>(
    state?.gym && state.gym.id === gymId ? state.gym : null,
  );
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
      <main className="site gp-page">
        <div className="gp-loading">
          <span className="auth-spinner" />
          <p>Loading gym…</p>
        </div>
      </main>
    );
  }

  if (!gym) {
    return (
      <main className="site gp-page">
        <div className="gp-not-found">
          <Dumbbell size={48} />
          <h1>Gym not found</h1>
          <p>It may have been removed from the map data.</p>
          <button className="gp-reserve-btn gp-reserve-btn--primary" onClick={() => navigate('/plan')}>
            Search gyms
          </button>
        </div>
      </main>
    );
  }

  return <GymProfile gym={gym} />;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function describe(gym: Gym, features: string[]): string {
  if (gym.description) return gym.description;
  const parts = [`${gym.name} is a gym${gym.area ? ` in ${gym.area}` : ''}.`];
  if (gym.hours) parts.push(`Listed opening hours: ${gym.hours}.`);
  if (features.length > 0) parts.push(`Facilities listed: ${features.join(', ')}.`);
  else parts.push('No facilities are listed for it on the map yet.');
  return parts.join(' ');
}

// Priority order for the highlights bar
const HIGHLIGHT_ORDER = ['parking', 'shower', 'ac', 'lockers', '24x7', 'pool', 'sauna', 'changing', 'water', 'women_only'];
const HIGHLIGHT_ICONS: Record<string, React.ReactNode> = {
  parking: <ParkingCircle size={18} />,
  shower: <ShowerHead size={18} />,
  ac: <Wind size={18} />,
  lockers: <Lock size={18} />,
  '24x7': <Clock size={18} />,
  pool: <Waves size={18} />,
  sauna: <Dumbbell size={18} />,
  changing: <Dumbbell size={18} />,
  water: <Dumbbell size={18} />,
  women_only: <Dumbbell size={18} />,
};

function getDescriptorFromRating(rating: number): string {
  const score = rating * 2;
  if (score >= 9.0) return 'Exceptional';
  if (score >= 8.5) return 'Wonderful';
  if (score >= 8.0) return 'Very Good';
  if (score >= 7.0) return 'Good';
  return 'Pleasant';
}

// ── LIGHTBOX ─────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: { id: string; url: string; alt: string | null }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [images.length, onClose]);

  return (
    <div className="gp-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo gallery">
      <button className="gp-lightbox__close" onClick={onClose} aria-label="Close gallery">
        <X size={24} />
      </button>
      <button
        className="gp-lightbox__nav gp-lightbox__nav--prev"
        onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
        aria-label="Previous photo"
      >
        ‹
      </button>
      <div className="gp-lightbox__inner" onClick={e => e.stopPropagation()}>
        <img
          src={images[idx].url}
          alt={images[idx].alt ?? `Photo ${idx + 1}`}
          className="gp-lightbox__img"
        />
        <p className="gp-lightbox__counter">{idx + 1} / {images.length}</p>
      </div>
      <button
        className="gp-lightbox__nav gp-lightbox__nav--next"
        onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
        aria-label="Next photo"
      >
        ›
      </button>
    </div>
  );
}

// ── MAIN PROFILE ─────────────────────────────────────────────────────────────

function GymProfile({ gym }: { gym: Gym }) {
  const navigate = useNavigate();
  const { converted } = useCurrency();
  const { format } = useCurrency();
  const [saved, toggleSaved] = useSavedGym(gym.id);
  const [selectedFeatures, setSelectedFeatures] = useStoredFeatures();
  const [showAllAbout, setShowAllAbout] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);

  useEffect(() => { window.scrollTo(0, 0); }, [gym.id]);

  const featureLabels = gym.features.map(id => FEATURE_LABELS[id] ?? id);
  const about = describe(gym, featureLabels);
  const longAbout = about.length > 220;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lon}`;
  const website = gym.website && /^https?:\/\//.test(gym.website) ? gym.website : null;

  // Highlights: up to 6 features the gym has, in priority order
  const highlights = HIGHLIGHT_ORDER.filter(id => gym.features.includes(id)).slice(0, 6);

  // Review display
  const reviewScore = gym.rating !== null ? (gym.rating * 2).toFixed(1) : null;
  const reviewDescriptor = gym.rating !== null ? getDescriptorFromRating(gym.rating) : null;

  // Photo grid helpers
  const imgs = gym.images;
  const hasPhotos = imgs.length > 0;

  function openLightbox(i: number) {
    if (!hasPhotos) return;
    setLightboxStart(i);
    setLightboxOpen(true);
  }

  function removeStarred(id: string) {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function share() {
    const data = { title: gym.name, text: gym.address ?? gym.name, url: window.location.href };
    if (navigator.share) { await navigator.share(data).catch(() => {}); return; }
    await navigator.clipboard?.writeText(window.location.href);
    setShareNote('Link copied');
    setTimeout(() => setShareNote(''), 2000);
  }

  return (
    <main className="site gp-page">

      {/* ── HEADER ── */}
      <header className="gp-header">
        <button className="gp-header__back" onClick={() => navigate(-1)} aria-label="Back to results">
          <ArrowLeft size={20} />
          <span>Search results</span>
        </button>
        <a className="brand gp-header__brand" href="/" aria-label="FitPath home">
          Fit<span>Path</span>
        </a>
        <div className="gp-header__actions">
          <CurrencyPicker />
          {shareNote && <span className="gp-share-note" role="status">{shareNote}</span>}
          <button className="gp-icon-btn" onClick={share} aria-label="Share gym">
            <Share2 size={18} />
          </button>
          <button
            className={`gp-icon-btn${saved ? ' gp-icon-btn--saved' : ''}`}
            onClick={toggleSaved}
            aria-label={saved ? 'Remove from saved' : 'Save gym'}
            aria-pressed={saved}
          >
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </header>

      {/* ── PHOTO GALLERY ── */}
      <section className="gp-gallery" aria-label="Gym photos">
        {hasPhotos ? (
          <>
            <div className="gp-gallery__grid">
              {/* Main large photo */}
              <button
                className="gp-gallery__main"
                onClick={() => openLightbox(0)}
                aria-label="Open photo gallery"
              >
                <img src={imgs[0].url} alt={imgs[0].alt ?? gym.name} />
                <div className="gp-gallery__zoom-hint"><ZoomIn size={16} /> View all photos</div>
              </button>

              {/* Secondary stack */}
              {imgs.length >= 2 && (
                <div className="gp-gallery__stack">
                  <button
                    className="gp-gallery__secondary"
                    onClick={() => openLightbox(1)}
                    aria-label="Open photo 2"
                  >
                    <img src={imgs[1].url} alt={imgs[1].alt ?? `${gym.name} photo 2`} />
                  </button>
                  {imgs.length >= 3 ? (
                    <button
                      className="gp-gallery__secondary gp-gallery__secondary--last"
                      onClick={() => openLightbox(2)}
                      aria-label="Open photo 3"
                    >
                      <img src={imgs[2].url} alt={imgs[2].alt ?? `${gym.name} photo 3`} />
                      {imgs.length > 3 && (
                        <div className="gp-gallery__more-badge">+{imgs.length - 3} photos</div>
                      )}
                    </button>
                  ) : (
                    <div className="gp-gallery__secondary gp-gallery__secondary--empty">
                      <Dumbbell size={28} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {imgs.length > 3 && (
              <div className="gp-gallery__thumbs">
                {imgs.slice(0, 6).map((img, i) => (
                  <button
                    key={img.id}
                    className="gp-gallery__thumb"
                    onClick={() => openLightbox(i)}
                    aria-label={`View photo ${i + 1}`}
                  >
                    <img src={img.url} alt="" loading="lazy" />
                  </button>
                ))}
                {imgs.length > 6 && (
                  <button
                    className="gp-gallery__thumb gp-gallery__thumb--more"
                    onClick={() => openLightbox(6)}
                  >
                    +{imgs.length - 6}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="gp-gallery__placeholder">
            <Dumbbell size={56} />
            <span>No photos available yet</span>
          </div>
        )}
      </section>

      {/* Videos */}
      {gym.videos.length > 0 && (
        <section className="gp-videos" aria-label="Gym videos">
          {gym.videos.map(v => (
            <video key={v.id} controls preload="metadata" playsInline aria-label={v.alt ?? `${gym.name} video`}>
              <source src={v.url} />
            </video>
          ))}
        </section>
      )}

      {/* ── 2-COLUMN BODY ── */}
      <div className="gp-body">

        {/* LEFT COLUMN — main content */}
        <div className="gp-body__main">

          {/* Title Section */}
          <div className="gp-title-section">
            <div className="gp-title-section__top">
              <h1 className="gp-gym-name">{gym.name}</h1>
              <div className="gp-display-stars" aria-label="Gym category">
                {[...Array(4)].map((_, i) => (
                  <Star key={i} size={16} fill="#FFB703" color="#FFB703" />
                ))}
              </div>
              {gym.openNow !== null && (
                <span className={`gp-status-badge${gym.openNow ? ' gp-status-badge--open' : ' gp-status-badge--closed'}`}>
                  {gym.openNow ? 'Open Now' : 'Closed'}
                </span>
              )}
            </div>

            <div className="gp-title-section__location">
              {gym.area && <span className="gp-location-area">{gym.area}</span>}
              {gym.distanceKm > 0 && (
                <>
                  <span className="gp-location-sep">·</span>
                  <MapPin size={14} />
                  <span>{gym.distanceKm} km from your search</span>
                </>
              )}
            </div>

            <div className="gp-title-section__address">
              <MapPin size={15} className="gp-address-pin" />
              <span>{gym.address ?? (gym.area ? `${gym.area} (full address not listed)` : 'Address not listed')}</span>
              <a className="gp-directions-link" href={directionsUrl} target="_blank" rel="noreferrer">
                <Navigation size={13} />
                Get Directions
              </a>
            </div>
          </div>

          {/* Highlights Bar */}
          {highlights.length > 0 && (
            <div className="gp-highlights">
              {highlights.map(id => (
                <div key={id} className="gp-highlight-chip">
                  <span className="gp-highlight-chip__icon">{HIGHLIGHT_ICONS[id] ?? <Dumbbell size={18} />}</span>
                  <span className="gp-highlight-chip__label">{FEATURE_LABELS[id] ?? id}</span>
                </div>
              ))}
              <a href="#features" className="gp-highlight-chip gp-highlight-chip--link">
                See all facilities →
              </a>
            </div>
          )}

          {/* Pass Availability Table */}
          <BookingPanel key={gym.id} gym={gym} />

          {/* About */}
          <section className="gp-section">
            <h2 className="gp-section-title">About {gym.name}</h2>
            <p className="gp-about-text">
              {showAllAbout || !longAbout ? about : `${about.slice(0, 220).trimEnd()}…`}
            </p>
            {longAbout && (
              <button
                type="button"
                className="gp-text-link gp-expand-btn"
                onClick={() => setShowAllAbout(v => !v)}
              >
                {showAllAbout ? 'Show less' : 'Read more'}
                <ChevronDown size={15} className={showAllAbout ? 'gp-flip' : ''} />
              </button>
            )}
          </section>

          {/* Full Features Grid */}
          <section className="gp-section" id="features">
            <h2 className="gp-section-title">Facilities</h2>
            <div className="gp-features-grid">
              {FEATURE_CATEGORIES.map(cat => (
                <div key={cat.title} className="gp-feature-cat">
                  <h3 className="gp-feature-cat__title">{cat.title}</h3>
                  <ul className="gp-feature-cat__list">
                    {cat.features.map(feat => {
                      const has = gym.features.includes(feat.id);
                      return (
                        <li key={feat.id} className={`gp-feature-item${has ? ' gp-feature-item--available' : ' gp-feature-item--unavailable'}`}>
                          <span className="gp-feature-item__indicator">
                            {has ? <Check size={13} /> : <X size={13} />}
                          </span>
                          <feat.Icon size={14} className="gp-feature-item__icon" />
                          <span className="gp-feature-item__label">{feat.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Gym Info (House Rules) */}
          <section className="gp-section">
            <h2 className="gp-section-title">Gym Info</h2>
            <dl className="gp-info-grid">
              <div className="gp-info-row">
                <dt>Opening hours</dt>
                <dd>{gym.hours ?? 'Not listed'}</dd>
              </div>
              {gym.phone && (
                <div className="gp-info-row">
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${gym.phone}`} className="gp-info-link">
                      <Phone size={13} /> {gym.phone}
                    </a>
                  </dd>
                </div>
              )}
              {website && (
                <div className="gp-info-row">
                  <dt>Website</dt>
                  <dd>
                    <a href={website} target="_blank" rel="noreferrer" className="gp-info-link">
                      <Globe size={13} /> Visit website
                    </a>
                  </dd>
                </div>
              )}
              {gym.distanceKm > 0 && (
                <div className="gp-info-row">
                  <dt>Distance from your search</dt>
                  <dd>{gym.distanceKm} km</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Reviews */}
          <Reviews key={`reviews-${gym.id}`} gymId={gym.id} />

          {/* Price disclaimer */}
          {(gym.bookable.length === 0 || converted) && (
            <p className="gp-price-note">
              {gym.bookable.length === 0 && 'Prices shown are sample estimates — this gym has not set its prices yet. '}
              {converted && 'Prices are converted from rupees at current exchange rates and are for reference only.'}
            </p>
          )}
        </div>

        {/* RIGHT COLUMN — sticky score + book widget */}
        <aside className="gp-body__aside">
          <div className="gp-sticky-widget">
            {/* Review Score */}
            <div className="gp-widget-score">
              {reviewScore !== null ? (
                <>
                  <div className="gp-widget-score__badge">{reviewScore}</div>
                  <div className="gp-widget-score__meta">
                    <strong>{reviewDescriptor}</strong>
                    <span>{gym.reviewCount} {gym.reviewCount === 1 ? 'review' : 'reviews'}</span>
                  </div>
                </>
              ) : (
                <div className="gp-widget-score__meta">
                  <strong>No reviews yet</strong>
                  <span>Be the first to review</span>
                </div>
              )}
            </div>

            {/* Price teaser */}
            <div className="gp-widget-price">
              <span className="gp-widget-price__from">From</span>
              <strong className="gp-widget-price__amount">{format(gym.prices.day)}</strong>
              <span className="gp-widget-price__unit">/ day pass</span>
            </div>

            {/* CTA */}
            <a href="#availability" className="gp-widget-cta">
              Book a Pass
            </a>
            <p className="gp-widget-note">Nothing charged now — pay at the gym</p>

            {/* Quick highlights in widget */}
            {highlights.length > 0 && (
              <div className="gp-widget-perks">
                {highlights.slice(0, 3).map(id => (
                  <span key={id} className="gp-widget-perk">
                    <Check size={12} /> {FEATURE_LABELS[id] ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="gp-mobile-bar">
        <div className="gp-mobile-bar__price">
          <span>From</span>
          <strong>{format(gym.prices.day)}/day</strong>
        </div>
        <a href="#availability" className="gp-mobile-bar__btn">
          Book a Pass
        </a>
      </div>

      {/* Lightbox */}
      {lightboxOpen && hasPhotos && (
        <Lightbox
          images={imgs}
          startIndex={lightboxStart}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}
