import { useMemo } from 'react';
import { Map, Star, Check, RotateCcw, Sparkles } from 'lucide-react';
import type { Gym } from '@/types';
import { FEATURE_LABELS, SUPPORTED_FEATURE_IDS } from '@/data/features';
import { useCurrency } from '@/lib/currency-context';

interface SidebarFiltersProps {
  gyms: Gym[];
  selectedFeatures: Set<string>;
  onToggleFeature: (id: string) => void;
  onClearAll: () => void;
  onOpenMap: () => void;
  priceRange: [number, number];
  onPriceChange: (range: [number, number]) => void;
  maxPriceLimit: number;
  minRating: number | null;
  onSelectRating: (rating: number | null) => void;
  openNowOnly: boolean;
  onToggleOpenNow: () => void;
}

const POPULAR_FEATURE_KEYS = [
  'parking',
  'shower',
  'ac',
  'lockers',
  'free_weights',
  '24x7',
  'pool',
  'sauna',
  'yoga',
  'boxing',
  'hiit',
  'women_only',
];

export default function SidebarFilters({
  gyms,
  selectedFeatures,
  onToggleFeature,
  onClearAll,
  onOpenMap,
  priceRange,
  onPriceChange,
  maxPriceLimit,
  minRating,
  onSelectRating,
  openNowOnly,
  onToggleOpenNow,
}: SidebarFiltersProps) {
  const { format } = useCurrency();

  // Dynamic feature counts across all currently loaded gyms
  const featureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of SUPPORTED_FEATURE_IDS) {
      counts[id] = 0;
    }
    for (const gym of gyms) {
      for (const feat of gym.features) {
        if (counts[feat] !== undefined) {
          counts[feat]++;
        }
      }
    }
    return counts;
  }, [gyms]);

  // Open now count
  const openNowCount = useMemo(() => {
    return gyms.filter(g => g.openNow === true).length;
  }, [gyms]);

  // Rating counts
  const ratingCounts = useMemo(() => {
    return {
      nine: gyms.filter(g => (g.rating ?? 0) >= 4.5).length,
      eight: gyms.filter(g => (g.rating ?? 0) >= 4.0).length,
      seven: gyms.filter(g => (g.rating ?? 0) >= 3.5).length,
    };
  }, [gyms]);

  const hasActiveFilters =
    selectedFeatures.size > 0 ||
    openNowOnly ||
    minRating !== null ||
    priceRange[0] > 0 ||
    priceRange[1] < maxPriceLimit;

  return (
    <aside className="bk-sidebar">
      {/* 1. Show on Map Mini-Card */}
      <div className="bk-map-card" onClick={onOpenMap} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpenMap()}>
        <div className="bk-map-card__preview">
          <div className="bk-map-card__grid" />
          <div className="bk-map-card__pulse" />
          <div className="bk-map-card__pin">
            <span className="bk-map-card__pin-dot" />
          </div>
        </div>
        <button type="button" className="bk-map-card__btn">
          <Map size={16} />
          <span>Show on map</span>
        </button>
      </div>

      {/* Filter Header with Clear All */}
      <div className="bk-filter-header">
        <h3 className="bk-filter-header__title">Filter by:</h3>
        {hasActiveFilters && (
          <button type="button" className="bk-filter-clear-btn" onClick={onClearAll}>
            <RotateCcw size={13} />
            <span>Reset all</span>
          </button>
        )}
      </div>

      {/* 2. Budget Slider */}
      <div className="bk-filter-group">
        <h4 className="bk-filter-group__title">Your budget (per month)</h4>
        <div className="bk-budget-inputs">
          <div className="bk-budget-input-box">
            <span className="bk-budget-label">Min</span>
            <strong>{format(priceRange[0])}</strong>
          </div>
          <span className="bk-budget-sep">—</span>
          <div className="bk-budget-input-box">
            <span className="bk-budget-label">Max</span>
            <strong>{format(priceRange[1])}</strong>
          </div>
        </div>
        <div className="bk-range-slider-wrap">
          <input
            type="range"
            min={0}
            max={maxPriceLimit}
            step={200}
            value={priceRange[1]}
            onChange={e => onPriceChange([priceRange[0], Number(e.target.value)])}
            className="bk-slider"
            aria-label="Max monthly budget"
          />
        </div>
      </div>

      {/* 3. Popular Filters */}
      <div className="bk-filter-group">
        <div className="bk-filter-group__header">
          <h4 className="bk-filter-group__title">Popular filters</h4>
          <Sparkles size={14} className="bk-filter-group__icon" />
        </div>

        <div className="bk-filter-list">
          {/* Open Now toggle */}
          <label className="bk-checkbox-row">
            <input
              type="checkbox"
              checked={openNowOnly}
              onChange={onToggleOpenNow}
              className="bk-checkbox"
            />
            <span className="bk-checkbox-label">Open Now</span>
            <span className="bk-checkbox-count">{openNowCount}</span>
          </label>

          {/* Popular amenities */}
          {POPULAR_FEATURE_KEYS.map(id => {
            const label = FEATURE_LABELS[id] ?? id;
            const count = featureCounts[id] ?? 0;
            const checked = selectedFeatures.has(id);

            return (
              <label key={id} className="bk-checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleFeature(id)}
                  className="bk-checkbox"
                />
                <span className="bk-checkbox-label">{label}</span>
                <span className="bk-checkbox-count">{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. Guest & Review Rating */}
      <div className="bk-filter-group">
        <h4 className="bk-filter-group__title">Review score</h4>
        <div className="bk-filter-list">
          <label className="bk-checkbox-row">
            <input
              type="checkbox"
              checked={minRating === 4.5}
              onChange={() => onSelectRating(minRating === 4.5 ? null : 4.5)}
              className="bk-checkbox"
            />
            <span className="bk-checkbox-label">Superb: 9+</span>
            <span className="bk-checkbox-count">{ratingCounts.nine}</span>
          </label>

          <label className="bk-checkbox-row">
            <input
              type="checkbox"
              checked={minRating === 4.0}
              onChange={() => onSelectRating(minRating === 4.0 ? null : 4.0)}
              className="bk-checkbox"
            />
            <span className="bk-checkbox-label">Very Good: 8+</span>
            <span className="bk-checkbox-count">{ratingCounts.eight}</span>
          </label>

          <label className="bk-checkbox-row">
            <input
              type="checkbox"
              checked={minRating === 3.5}
              onChange={() => onSelectRating(minRating === 3.5 ? null : 3.5)}
              className="bk-checkbox"
            />
            <span className="bk-checkbox-label">Good: 7+</span>
            <span className="bk-checkbox-count">{ratingCounts.seven}</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
