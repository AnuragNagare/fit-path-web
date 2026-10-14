import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { UserButton } from '@clerk/react';
import { ArrowDownUp, Dumbbell, Filter, Pencil, Star, Users, X } from 'lucide-react';
import type { SearchQuery, Gym } from '@/types';
import { FEATURE_LABELS } from '@/data/features';
import { useApi } from '@/lib/api';
import { useCurrency } from '@/lib/currency-context';
import { useIsAdmin } from '@/lib/useIsAdmin';
import { useIsVendor } from '@/lib/useIsVendor';
import { useStoredFeatures } from '@/lib/useStoredQuery';
import FilterPanel from '@/components/FilterPanel';
import CurrencyPicker from '@/components/CurrencyPicker';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// Matches DEFAULT_RADIUS_KM in api/gyms.ts.
const SEARCH_RADIUS_KM = 10;

type SortMode = 'closest' | 'az';

function makeIcon(active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="map-marker${active ? ' map-marker--active' : ''}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
}

// Fits the search circle.
function FitSearch({ query }: { query: SearchQuery }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLng(query.place.lat, query.place.lon).toBounds(SEARCH_RADIUS_KM * 2000), { padding: [8, 8] });
  }, [query, map]);
  return null;
}

function PanToGym({ gym }: { gym: Gym | null }) {
  const map = useMap();
  useEffect(() => {
    if (gym) map.panTo([gym.lat, gym.lon], { animate: true });
  }, [gym, map]);
  return null;
}

function MapClickAway({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

interface Props {
  query: SearchQuery | null;
}

export default function MapView({ query }: Props) {
  const navigate = useNavigate();
  const { searchGyms } = useApi();
  const { format } = useCurrency();
  const isAdmin = useIsAdmin();
  const isVendor = useIsVendor();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useStoredFeatures();
  const [sort, setSort] = useState<SortMode>('closest');
  const [attempt, setAttempt] = useState(0); // bumped by "Try again"

  const activeRowRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setStatus('loading');
    setActiveId(null);
    searchGyms(query)
      .then(result => { if (!cancelled) { setGyms(result.gyms); setStatus('ready'); } })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load gyms.');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [query, searchGyms, attempt]);

  // A gym must have every selected feature.
  const visibleGyms = useMemo(
    () => gyms.filter(g => Array.from(selectedFeatures).every(id => g.features.includes(id))),
    [gyms, selectedFeatures],
  );

  // The gym picked on the map, if it is still visible after filtering.
  const activeGym = visibleGyms.find(g => g.id === activeId) ?? null;

  // Sorted list, with the picked gym moved to the top.
  const listedGyms = useMemo(() => {
    const sorted = sort === 'az'
      ? [...visibleGyms].sort((a, b) => a.name.localeCompare(b.name))
      : visibleGyms; // the API already returns nearest first
    return activeGym ? [activeGym, ...sorted.filter(g => g.id !== activeGym.id)] : sorted;
  }, [activeGym, visibleGyms, sort]);

  // Bring the picked gym's row into view if it is below the fold.
  useEffect(() => {
    if (activeId) activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeId]);

  if (!query) return <Navigate to="/plan" replace />;

  const placeLabel = query.place.label === 'My location' ? 'Your location' : query.place.label;

  function openGym(gym: Gym) {
    navigate(`/gym/${gym.id}`, { state: { gym } });
  }

  function toggleFeature(id: string) {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="site map-site">
      <header className="map-header">
        <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
        <div className="header-right">
          {isAdmin && <Link className="header-link" to="/admin">Admin</Link>}
          {isVendor && <Link className="header-link" to="/vendor">My gym</Link>}
          <Link className="header-link" to="/bookings">My bookings</Link>
          <CurrencyPicker />
          <UserButton />
        </div>
      </header>

      {/* Map (unchanged) */}
      <div className="leaflet-wrap">
        <MapContainer
          center={[query.place.lat, query.place.lon]}
          zoom={13}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitSearch query={query} />
          <PanToGym gym={activeGym} />
          <MapClickAway onClick={() => setActiveId(null)} />

          <Circle
            center={[query.place.lat, query.place.lon]}
            radius={SEARCH_RADIUS_KM * 1000}
            pathOptions={{ color: '#FF5A0F', weight: 2, dashArray: '8 8', fillColor: '#FF5A0F', fillOpacity: 0.05 }}
          />
          <CircleMarker center={[query.place.lat, query.place.lon]} radius={8} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#FF5A0F', fillOpacity: 1 }}>
            <Tooltip>{query.place.label}</Tooltip>
          </CircleMarker>

          {visibleGyms.map(gym => (
            <Marker
              key={gym.id}
              position={[gym.lat, gym.lon]}
              icon={makeIcon(gym.id === activeId)}
              zIndexOffset={gym.id === activeId ? 1000 : 0}
              eventHandlers={{ click: () => setActiveId(gym.id) }}
            />
          ))}
        </MapContainer>
      </div>

      <section className="results">
        <div className="results-head">
          <div className="results-title">
            <div className="results-title-row">
              <h2>Gyms near {placeLabel}</h2>
              <button type="button" className="edit-pill" onClick={() => navigate('/plan')}>
                Edit <Pencil size={14} />
              </button>
            </div>
            <p className="results-sub">Within {SEARCH_RADIUS_KM} km</p>
            <p className="results-trip">
              <Users size={14} /> {query.people} {query.people === 1 ? 'person' : 'people'}
            </p>
          </div>
          <span className="results-count">
            {status === 'loading' ? 'Searching…' : status === 'error' ? 'Search failed' : `${visibleGyms.length} found`}
          </span>
        </div>

        <div className="results-tools">
          <div className="feature-chips">
            {Array.from(selectedFeatures).map(id => (
              <button key={id} type="button" className="feature-chip" onClick={() => toggleFeature(id)} aria-label={`Remove ${FEATURE_LABELS[id] ?? id} filter`}>
                {FEATURE_LABELS[id] ?? id} <X size={13} />
              </button>
            ))}
            {selectedFeatures.size === 0 && (
              <button type="button" className="feature-chip feature-chip--add" onClick={() => setFilterOpen(true)}>
                Filter by features
              </button>
            )}
          </div>
          <div className="results-actions">
            <button type="button" className="icon-action" onClick={() => setFilterOpen(true)} aria-label="Filter by features">
              <Filter size={22} fill="currentColor" />
            </button>
            <button
              type="button"
              className="icon-action sort-action"
              onClick={() => setSort(s => (s === 'closest' ? 'az' : 'closest'))}
              aria-label={`Sort: ${sort === 'closest' ? 'closest first' : 'A to Z'}. Change sort`}
            >
              <ArrowDownUp size={20} />
              <span>{sort === 'closest' ? 'Closest' : 'A–Z'}</span>
            </button>
          </div>
        </div>

        <div className="result-rows">
          {status === 'loading' && <p className="listing-empty">Finding gyms near {placeLabel}…</p>}
          {status === 'error' && (
            <div className="listing-empty">
              <p>{error}</p>
              <button type="button" className="edit-pill" onClick={() => setAttempt(n => n + 1)}>Try again</button>
            </div>
          )}
          {status === 'ready' && visibleGyms.length === 0 && (
            <p className="listing-empty">
              {gyms.length > 0
                ? 'No gyms match all selected features. Remove a filter to see more.'
                : `No gyms found within ${SEARCH_RADIUS_KM} km of ${placeLabel}. Try a nearby area or a bigger city.`}
            </p>
          )}
          {status === 'ready' && listedGyms.map(gym => {
            const active = gym.id === activeId;
            const meta = [gym.features.includes('parking') ? 'Parking' : null, gym.openNow === null ? null : gym.openNow ? 'Open' : 'Closed'].filter(Boolean);
            return (
              <article
                key={gym.id}
                ref={active ? activeRowRef : undefined}
                className={`gym-row${active ? ' gym-row--active' : ''}`}
                onClick={() => openGym(gym)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openGym(gym)}
                aria-label={`${gym.name}, open profile`}
              >
                <div className="gym-row-photo" aria-hidden="true">
                  {gym.images[0] ? <img src={gym.images[0].url} alt="" loading="lazy" /> : <Dumbbell size={30} />}
                </div>
                <div className="gym-row-main">
                  <strong>{gym.name}</strong>
                  <span className="gym-row-area">{gym.area ?? 'Area not listed'}</span>
                  {active && (
                    <button type="button" className="details-pill" onClick={e => { e.stopPropagation(); openGym(gym); }}>
                      Details
                    </button>
                  )}
                </div>
                <div className="gym-row-side">
                  <b className="gym-row-dist">{gym.distanceKm} km</b>
                  <span className="gym-row-meta">
                    {gym.rating !== null ? <>{gym.rating} <Star size={13} fill="currentColor" /></> : 'No reviews yet'}
                    {meta.length > 0 && <span>{meta.join(' • ')}</span>}
                  </span>
                  <span className="gym-row-price">
                    {format(gym.prices.month)}/mo <i>|</i> {format(gym.prices.day)}/day
                    {!(gym.bookable.includes('month') && gym.bookable.includes('day')) && <small className="gym-row-sample" title="This gym has not set its prices yet">sample</small>}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Filter panel */}
      <FilterPanel
        open={filterOpen}
        selected={selectedFeatures}
        onToggle={toggleFeature}
        onClear={() => setSelectedFeatures(new Set())}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
