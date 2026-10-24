import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { X, ArrowUpDown, Dumbbell } from 'lucide-react';
import type { SearchQuery, Gym } from '@/types';
import { FEATURE_LABELS } from '@/data/features';
import { useApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { useIsAdmin } from '@/lib/useIsAdmin';
import { useIsVendor } from '@/lib/useIsVendor';
import {
  getCachedSearchResults,
  getStoredFilters,
  getStoredScrollY,
  makeQueryKey,
  setCachedSearchResults,
  setStoredFilters,
  setStoredScrollY,
  useStoredFeatures,
} from '@/lib/useStoredQuery';
import CurrencyPicker from '@/components/CurrencyPicker';
import SearchRibbon from '@/components/booking/SearchRibbon';
import SidebarFilters from '@/components/booking/SidebarFilters';
import GymCard from '@/components/booking/GymCard';
import MapModal from '@/components/booking/MapModal';

// Matches DEFAULT_RADIUS_KM in api/gyms.ts.
const SEARCH_RADIUS_KM = 10;

type SortMode = 'closest' | 'price_low' | 'price_high' | 'rating' | 'az';

const MAX_PRICE_DEFAULT = 12000;

interface Props {
  query: SearchQuery | null;
}

export default function MapView({ query }: Props) {
  const navigate = useNavigate();
  const { searchGyms } = useApi();
  const { format } = useCurrency();
  const isAdmin = useIsAdmin();
  const isVendor = useIsVendor();

  // Instant cache retrieval so returning from a gym profile doesn't re-search
  const cachedGyms = useMemo(() => getCachedSearchResults(query), [query]);
  const initialFilters = useMemo(() => getStoredFilters(), []);

  const [gyms, setGyms] = useState<Gym[]>(() => cachedGyms ?? []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() => (cachedGyms ? 'ready' : 'loading'));
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Filter & Sort States (restored from saved search session if present)
  const [selectedFeatures, setSelectedFeatures] = useStoredFeatures();
  const [sort, setSort] = useState<SortMode>((initialFilters?.sort as SortMode) ?? 'closest');
  const [attempt, setAttempt] = useState(0);
  const [priceRange, setPriceRange] = useState<[number, number]>(initialFilters?.priceRange ?? [0, MAX_PRICE_DEFAULT]);
  const [minRating, setMinRating] = useState<number | null>(initialFilters?.minRating ?? null);
  const [openNowOnly, setOpenNowOnly] = useState(initialFilters?.openNowOnly ?? false);

  // Sync filter changes to session storage so navigating back preserves them
  useEffect(() => {
    setStoredFilters({
      sort,
      priceRange,
      minRating,
      openNowOnly,
    });
  }, [sort, priceRange, minRating, openNowOnly]);

  // Map Modal
  const [mapModalOpen, setMapModalOpen] = useState(false);

  // Favorites (persisted locally)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('fitpath_favs');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const lastFetchedKeyRef = useRef<string>(cachedGyms ? makeQueryKey(query) : '');
  const restoredScrollRef = useRef(false);

  // Restore scroll position when search results are ready
  useEffect(() => {
    if (status === 'ready' && gyms.length > 0 && !restoredScrollRef.current) {
      const savedY = getStoredScrollY();
      if (savedY > 0) {
        restoredScrollRef.current = true;
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedY, behavior: 'instant' });
        });
      }
    }
  }, [status, gyms.length]);

  // Continuously record scroll position so returning to results keeps exact position
  useEffect(() => {
    let timer: number;
    const handleScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setStoredScrollY(window.scrollY);
      }, 150);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Fetch gyms for query if not already in cache
  useEffect(() => {
    if (!query) return;
    const currentKey = makeQueryKey(query);

    // If we already have gyms loaded for this exact location query and this is not a manual retry, skip fetching
    if (gyms.length > 0 && lastFetchedKeyRef.current === currentKey && attempt === 0) {
      return;
    }

    const cached = getCachedSearchResults(query);
    if (cached && attempt === 0) {
      setGyms(cached);
      setStatus('ready');
      lastFetchedKeyRef.current = currentKey;
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setActiveId(null);

    searchGyms(query)
      .then(result => {
        if (!cancelled) {
          setGyms(result.gyms);
          setCachedSearchResults(query, result.gyms);
          setStatus('ready');
          lastFetchedKeyRef.current = currentKey;
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load gyms.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [query, searchGyms, attempt]);

  // Favorite toggle
  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('fitpath_favs', JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  // Filter pipeline
  const visibleGyms = useMemo(() => {
    return gyms.filter(gym => {
      // 1. Feature checklist (gym must have all selected features)
      const hasFeatures = Array.from(selectedFeatures).every(id => gym.features.includes(id));
      if (!hasFeatures) return false;

      // 2. Open Now filter
      if (openNowOnly && gym.openNow !== true) return false;

      // 3. Price filter
      const monthPrice = gym.prices.month;
      if (monthPrice > priceRange[1]) return false;

      // 4. Rating filter
      if (minRating !== null) {
        const rating = gym.rating ?? 0;
        if (rating < minRating) return false;
      }

      return true;
    });
  }, [gyms, selectedFeatures, openNowOnly, priceRange, minRating]);

  // Currently active gym on map / card
  const activeGym = useMemo(() => {
    return visibleGyms.find(g => g.id === activeId) ?? null;
  }, [visibleGyms, activeId]);

  // Sorting pipeline
  const listedGyms = useMemo(() => {
    const list = [...visibleGyms];

    switch (sort) {
      case 'price_low':
        list.sort((a, b) => a.prices.month - b.prices.month);
        break;
      case 'price_high':
        list.sort((a, b) => b.prices.month - a.prices.month);
        break;
      case 'rating':
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'az':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'closest':
      default:
        list.sort((a, b) => a.distanceKm - b.distanceKm);
        break;
    }

    // Keep active gym at top if selected
    return activeGym ? [activeGym, ...list.filter(g => g.id !== activeGym.id)] : list;
  }, [activeGym, visibleGyms, sort]);

  // Bring active gym into view if below fold
  useEffect(() => {
    if (activeId) activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeId]);

  if (!query) return <Navigate to="/plan" replace />;

  const placeLabel = query.place.label === 'My location' ? 'Your location' : query.place.label;

  function openGym(gym: Gym) {
    setStoredScrollY(window.scrollY);
    navigate(`/gym/${gym.id}`, { state: { gym } });
  }

  function handleShowOnMap(gym: Gym) {
    setActiveId(gym.id);
    setMapModalOpen(true);
  }

  function toggleFeature(id: string) {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearAllFilters() {
    setSelectedFeatures(new Set());
    setPriceRange([0, MAX_PRICE_DEFAULT]);
    setMinRating(null);
    setOpenNowOnly(false);
  }

  const activeFiltersCount =
    selectedFeatures.size +
    (openNowOnly ? 1 : 0) +
    (minRating !== null ? 1 : 0) +
    (priceRange[1] < MAX_PRICE_DEFAULT ? 1 : 0);

  return (
    <div className="site bk-page-container">
      {/* 1. Global Navigation Header */}
      <header className="map-header">
        <a className="brand" href="/" aria-label="FitPath home">
          Fit<span>Path</span>
        </a>
        <div className="header-right">
          {isAdmin && <Link className="header-link" to="/admin">Admin</Link>}
          {isVendor && <Link className="header-link" to="/vendor">My gym</Link>}
          <Link className="header-link" to="/bookings">My bookings</Link>
          <CurrencyPicker />
          <UserButton />
        </div>
      </header>

      {/* 2. Top Search Ribbon (Booking.com yellow/accent search bar) */}
      <SearchRibbon
        query={query}
        onEditSearch={() => navigate('/plan')}
        radiusKm={SEARCH_RADIUS_KM}
      />

      {/* 3. Main 2-Column Booking Layout */}
      <main className="bk-layout">
        {/* Left Sidebar */}
        <SidebarFilters
          gyms={gyms}
          selectedFeatures={selectedFeatures}
          onToggleFeature={toggleFeature}
          onClearAll={clearAllFilters}
          onOpenMap={() => setMapModalOpen(true)}
          priceRange={priceRange}
          onPriceChange={setPriceRange}
          maxPriceLimit={MAX_PRICE_DEFAULT}
          minRating={minRating}
          onSelectRating={setMinRating}
          openNowOnly={openNowOnly}
          onToggleOpenNow={() => setOpenNowOnly(v => !v)}
        />

        {/* Right Main Results Feed */}
        <section className="bk-main-feed">
          {/* Feed Header */}
          <div className="bk-feed-head">
            <div className="bk-feed-head__top">
              <h1 className="bk-feed-head__title">
                {placeLabel}:
                <span className="bk-feed-head__count">
                  {status === 'loading'
                    ? 'Searching gyms…'
                    : status === 'error'
                    ? 'Search error'
                    : `${visibleGyms.length} gyms found`}
                </span>
              </h1>

              {/* Sort by dropdown */}
              <div className="bk-feed-sort">
                <span className="bk-feed-sort__label">Sort by:</span>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortMode)}
                  className="bk-feed-sort__select"
                  aria-label="Sort search results"
                >
                  <option value="closest">Distance (Closest first)</option>
                  <option value="price_low">Price (Lowest first)</option>
                  <option value="price_high">Price (Highest first)</option>
                  <option value="rating">Review score (Highest first)</option>
                  <option value="az">Name (A to Z)</option>
                </select>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFiltersCount > 0 && (
              <div className="bk-active-chips">
                {Array.from(selectedFeatures).map(id => (
                  <button
                    key={id}
                    type="button"
                    className="bk-active-chip"
                    onClick={() => toggleFeature(id)}
                    aria-label={`Remove ${FEATURE_LABELS[id] ?? id} filter`}
                  >
                    <span>{FEATURE_LABELS[id] ?? id}</span>
                    <X size={12} />
                  </button>
                ))}
                {openNowOnly && (
                  <button
                    type="button"
                    className="bk-active-chip"
                    onClick={() => setOpenNowOnly(false)}
                  >
                    <span>Open Now</span>
                    <X size={12} />
                  </button>
                )}
                {minRating !== null && (
                  <button
                    type="button"
                    className="bk-active-chip"
                    onClick={() => setMinRating(null)}
                  >
                    <span>Rating: {minRating * 2}+</span>
                    <X size={12} />
                  </button>
                )}
                {priceRange[1] < MAX_PRICE_DEFAULT && (
                  <button
                    type="button"
                    className="bk-active-chip"
                    onClick={() => setPriceRange([0, MAX_PRICE_DEFAULT])}
                  >
                    <span>Max {format(priceRange[1])}</span>
                    <X size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="bk-filter-clear-btn"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Cards Stack */}
          <div className="bk-cards-stack">
            {status === 'loading' && (
              <div className="listing-empty">
                <p>Finding gyms near {placeLabel}…</p>
              </div>
            )}

            {status === 'error' && (
              <div className="listing-empty">
                <p>{error}</p>
                <button
                  type="button"
                  className="edit-pill"
                  onClick={() => setAttempt(n => n + 1)}
                >
                  Try again
                </button>
              </div>
            )}

            {status === 'ready' && visibleGyms.length === 0 && (
              <div className="listing-empty">
                <Dumbbell size={36} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
                <p>
                  {gyms.length > 0
                    ? 'No gyms match all your selected filters. Try removing some filters or adjusting your budget.'
                    : `No gyms found within ${SEARCH_RADIUS_KM} km of ${placeLabel}. Try a broader area or a nearby city.`}
                </p>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    className="edit-pill"
                    onClick={clearAllFilters}
                    style={{ marginTop: 12 }}
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            )}

            {status === 'ready' &&
              listedGyms.map(gym => (
                <div key={gym.id} ref={gym.id === activeId ? activeRowRef : undefined}>
                  <GymCard
                    gym={gym}
                    active={gym.id === activeId}
                    isFavorite={favorites.has(gym.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpenGym={openGym}
                    onShowOnMap={handleShowOnMap}
                  />
                </div>
              ))}
          </div>
        </section>
      </main>

      {/* 4. Fullscreen Interactive Map Modal (Booking.com style) */}
      <MapModal
        open={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        gyms={visibleGyms}
        selectedGym={activeGym}
        onSelectGym={gym => setActiveId(gym ? gym.id : null)}
        onOpenGym={openGym}
        searchQuery={query}
      />
    </div>
  );
}
