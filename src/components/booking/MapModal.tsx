import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Dumbbell, MapPin, ChevronRight, Star } from 'lucide-react';
import type { Gym, SearchQuery } from '@/types';
import { useCurrency } from '@/lib/currency-context';

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  gyms: Gym[];
  selectedGym: Gym | null;
  onSelectGym: (gym: Gym) => void;
  onOpenGym: (gym: Gym) => void;
  searchQuery: SearchQuery;
}

const SEARCH_RADIUS_KM = 10;

function createMarkerIcon(active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="bk-map-marker${active ? ' bk-map-marker--active' : ''}">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
}

function PanToGym({ gym }: { gym: Gym | null }) {
  const map = useMap();
  useEffect(() => {
    if (gym) {
      map.panTo([gym.lat, gym.lon], { animate: true });
    }
  }, [gym, map]);
  return null;
}

function FitSearch({ query }: { query: SearchQuery }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLng(query.place.lat, query.place.lon).toBounds(SEARCH_RADIUS_KM * 2000), {
      padding: [40, 40],
    });
  }, [query, map]);
  return null;
}

export default function MapModal({
  open,
  onClose,
  gyms,
  selectedGym,
  onSelectGym,
  onOpenGym,
  searchQuery,
}: MapModalProps) {
  const { format } = useCurrency();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bk-map-modal" role="dialog" aria-modal="true" ref={modalRef}>
      {/* Modal Header */}
      <header className="bk-map-modal__header">
        <div className="bk-map-modal__info">
          <div className="bk-map-modal__title-row">
            <MapPin size={18} className="bk-map-modal__pin-icon" />
            <h2 className="bk-map-modal__title">
              Gyms in {searchQuery.place.label === 'My location' ? 'your area' : searchQuery.place.label}
            </h2>
            <span className="bk-map-modal__count-pill">{gyms.length} gyms</span>
          </div>
          <span className="bk-map-modal__sub">Click any pin on the map to inspect gym details & pricing</span>
        </div>

        <button
          type="button"
          className="bk-map-modal__close-btn"
          onClick={onClose}
          aria-label="Close map"
        >
          <X size={22} />
        </button>
      </header>

      {/* Map Body */}
      <div className="bk-map-modal__canvas">
        <MapContainer
          center={[searchQuery.place.lat, searchQuery.place.lon]}
          zoom={13}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitSearch query={searchQuery} />
          <PanToGym gym={selectedGym} />

          {/* Search Radius Circle */}
          <Circle
            center={[searchQuery.place.lat, searchQuery.place.lon]}
            radius={SEARCH_RADIUS_KM * 1000}
            pathOptions={{
              color: '#FF5A0F',
              weight: 2,
              dashArray: '8 8',
              fillColor: '#FF5A0F',
              fillOpacity: 0.04,
            }}
          />
          <CircleMarker
            center={[searchQuery.place.lat, searchQuery.place.lon]}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#FF5A0F', fillOpacity: 1 }}
          >
            <Tooltip>{searchQuery.place.label}</Tooltip>
          </CircleMarker>

          {/* Gym Markers */}
          {gyms.map(gym => (
            <Marker
              key={gym.id}
              position={[gym.lat, gym.lon]}
              icon={createMarkerIcon(gym.id === selectedGym?.id)}
              zIndexOffset={gym.id === selectedGym?.id ? 1000 : 0}
              eventHandlers={{
                click: () => onSelectGym(gym),
              }}
            />
          ))}
        </MapContainer>

        {/* Floating Bottom Card for Selected Gym */}
        {selectedGym && (
          <div className="bk-floating-card">
            <div className="bk-floating-card__media">
              {selectedGym.images && selectedGym.images[0]?.url ? (
                <img src={selectedGym.images[0].url} alt={selectedGym.name} />
              ) : (
                <div className="bk-floating-card__fallback">
                  <Dumbbell size={24} />
                </div>
              )}
            </div>

            <div className="bk-floating-card__details">
              <div className="bk-floating-card__title-row">
                <strong className="bk-floating-card__name">{selectedGym.name}</strong>
                {selectedGym.rating && (
                  <span className="bk-floating-card__score">
                    {(selectedGym.rating * 2).toFixed(1)}
                  </span>
                )}
              </div>

              <div className="bk-floating-card__meta">
                <span>{selectedGym.area ?? 'City Area'}</span>
                <span>•</span>
                <span>{selectedGym.distanceKm} km away</span>
              </div>

              <div className="bk-floating-card__price-row">
                <div className="bk-floating-card__prices">
                  <span className="bk-floating-card__main-price">
                    {format(selectedGym.prices.month)}
                    <small>/mo</small>
                  </span>
                  <span className="bk-floating-card__day-price">
                    {format(selectedGym.prices.day)}/day
                  </span>
                </div>

                <button
                  type="button"
                  className="bk-floating-card__action-btn"
                  onClick={() => onOpenGym(selectedGym)}
                >
                  <span>View Gym</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className="bk-floating-card__dismiss"
              onClick={() => onSelectGym(null as unknown as Gym)}
              aria-label="Dismiss preview"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
