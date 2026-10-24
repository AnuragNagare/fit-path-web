import { MapPin, Users, Pencil, Compass } from 'lucide-react';
import type { SearchQuery } from '@/types';

interface SearchRibbonProps {
  query: SearchQuery;
  onEditSearch: () => void;
  radiusKm?: number;
}

export default function SearchRibbon({
  query,
  onEditSearch,
  radiusKm = 10,
}: SearchRibbonProps) {
  const placeLabel =
    query.place.label === 'My location' ? 'Your current location' : query.place.label;

  return (
    <div className="bk-search-ribbon">
      <div className="bk-search-ribbon__inner">
        <div className="bk-search-pill bk-search-pill--location">
          <MapPin size={18} className="bk-search-icon" />
          <div className="bk-search-pill__text">
            <span className="bk-search-pill__label">Destination</span>
            <strong className="bk-search-pill__val" title={placeLabel}>
              {placeLabel}
            </strong>
          </div>
        </div>

        <div className="bk-search-divider" />

        <div className="bk-search-pill bk-search-pill--radius">
          <Compass size={18} className="bk-search-icon" />
          <div className="bk-search-pill__text">
            <span className="bk-search-pill__label">Search Radius</span>
            <strong className="bk-search-pill__val">Within {radiusKm} km</strong>
          </div>
        </div>

        <div className="bk-search-divider" />

        <div className="bk-search-pill bk-search-pill--guests">
          <Users size={18} className="bk-search-icon" />
          <div className="bk-search-pill__text">
            <span className="bk-search-pill__label">Members</span>
            <strong className="bk-search-pill__val">
              {query.people} {query.people === 1 ? 'adult / guest' : 'adults / guests'}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="bk-search-edit-btn"
          onClick={onEditSearch}
          aria-label="Edit search parameters"
        >
          <Pencil size={15} />
          <span>Edit Search</span>
        </button>
      </div>
    </div>
  );
}
