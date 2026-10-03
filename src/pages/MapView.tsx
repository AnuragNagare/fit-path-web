import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Circle, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { UserButton } from '@clerk/react';
import { ArrowDownUp, Dumbbell, Filter, Pencil, Star, Users, X } from 'lucide-react';
import type { RouteQuery, Gym, RouteInfo } from '@/types';
import { FEATURE_LABELS } from '@/data/features';
import { useApi } from '@/lib/api';
import { mockPrices, mockRating } from '@/lib/mock';
import { useStoredFeatures } from '@/lib/useStoredQuery';
import FilterPanel from '@/components/FilterPanel';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// Matches DEFAULT_RADIUS_KM in api/gyms.ts.
const NEARBY_RADIUS_KM = 3;

type SortMode = 'closest' | 'az';

function makeIcon(active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="map-marker${active ? ' map-marker--active' : ''}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
}

// Fits the whole route, or the 3 km search circle in nearby mode.
function FitSearch({ query, route }: { query: RouteQuery; route: RouteInfo | null }) {
  const map = useMap();
  useEffect(() => {
    if (query.to) {
      map.fitBounds(route?.coordinates ?? [[query.from.lat, query.from.lon], [query.to.lat, query.to.lon]], {
        padding: [60, 60],
        maxZoom: 15,
      });
    } else {
      map.fitBounds(L.latLng(query.from.lat, query.from.lon).toBounds(NEARBY_RADIUS_KM * 2000), { padding: [8, 8] });
    }
  }, [query, route, map]);
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
  query: RouteQuery | null;
}

export default function MapView({ query }: Props) {
  const navigate = useNavigate();
  const { searchGyms } = useApi();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
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
      .then(result => { if (!cancelled) { setGyms(result.gyms); setRoute(result.route); setStatus('ready'); } })
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

  const nearby = !query.to;
  const placeLabel = query.from.label === 'My location' ? 'Your location' : query.from.label;

  function openGym(gym: Gym) {
    navigate(`/gym/${gym.id}`, { state: { selectedFeatures: Array.from(selectedFeatures), gym, nearby } });
  }

  function toggleFeature(id: string) {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  let subtitle = placeLabel;
  if (query.to) {
    subtitle = `${query.from.label} → ${query.to.label}`;
    if (route?.type === 'road') {
      subtitle += ` · ${route.distanceKm} km${route.durationMin !== null ? ` · ${route.durationMin} min drive` : ''}`;
    } else if (route) {
      subtitle += ' · straight-line route (road routing unavailable)';
    }
  }

  return (
    <div className="site map-site">
      <header className="map-header">
        <a className="brand" href="/" aria-label="Trace home">Tra<span>ce</span></a>
        <UserButton />
      </header>

      {/* Map (unchanged) */}
      <div className="leaflet-wrap">
        <MapContainer
          center={[query.from.lat, query.from.lon]}
          zoom={13}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitSearch query={query} route={route} />
          <PanToGym gym={activeGym} />
          <MapClickAway onClick={() => setActiveId(null)} />

          {query.to ? (
            <>
              <Polyline
                positions={route?.coordinates ?? [[query.from.lat, query.from.lon], [query.to.lat, query.to.lon]]}
                pathOptions={route?.type === 'road' ? { color: '#b8ff14', weight: 5 } : { color: '#b8ff14', weight: 4, dashArray: '10 10' }}
              />
              <CircleMarker center={[query.to.lat, query.to.lon]} radius={8} pathOptions={{ color: '#0b0c0c', fillColor: '#ffffff', fillOpacity: 1 }}>
                <Tooltip>End: {query.to.label}</Tooltip>
              </CircleMarker>
            </>
          ) : (
            <Circle
              center={[query.from.lat, query.from.lon]}
              radius={NEARBY_RADIUS_KM * 1000}
              pathOptions={{ color: '#b8ff14', weight: 2, dashArray: '8 8', fillColor: '#b8ff14', fillOpacity: 0.05 }}
            />
          )}
          <CircleMarker center={[query.from.lat, query.from.lon]} radius={8} pathOptions={{ color: '#0b0c0c', fillColor: '#b8ff14', fillOpacity: 1 }}>
            <Tooltip>{query.to ? `Start: ${query.from.label}` : query.from.label}</Tooltip>
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
              <h2>{nearby ? 'Gyms around you' : 'Gyms on your route'}</h2>
              <button type="button" className="edit-pill" onClick={() => navigate('/plan')}>
                Edit <Pencil size={14} />
              </button>
            </div>
            <p className="results-sub">{subtitle}</p>
            <p className="results-trip">
              <Users size={14} /> {query.people} {query.people === 1 ? 'person' : 'people'}
              {query.startDate && <> · {query.startDate}{query.endDate ? ` → ${query.endDate}` : ''}</>}
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
          {status === 'loading' && <p className="listing-empty">{nearby ? 'Finding gyms near you…' : 'Finding gyms along your route…'}</p>}
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
                : nearby
                  ? `No gyms found within ${NEARBY_RADIUS_KM} km. Add a destination or try a different starting point.`
                  : 'No gyms found along this route. Try a longer route or different places.'}
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
                <div className="gym-row-photo" aria-hidden="true"><Dumbbell size={30} /></div>
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
                    {mockRating(gym.id)} <Star size={13} fill="currentColor" />
                    {meta.length > 0 && <span>{meta.join(' • ')}</span>}
                  </span>
                  <span className="gym-row-price">{mockPrices(gym.id).month}/mo <i>|</i> {mockPrices(gym.id).day}/day</span>
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
