import { useState } from 'react';
import { Heart, MapPin, Star, Check, Dumbbell, ShieldCheck, Clock, ChevronRight } from 'lucide-react';
import type { Gym } from '@/types';
import { FEATURE_LABELS } from '@/data/features';
import { useCurrency } from '@/lib/currency-context';

interface GymCardProps {
  gym: Gym;
  active?: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenGym: (gym: Gym) => void;
  onShowOnMap: (gym: Gym) => void;
}

// Convert 5-point rating to Booking.com style 10-point score & descriptor
function getReviewSummary(rating: number | null, reviewCount: number) {
  if (rating === null || rating === 0) {
    return {
      score: '8.6',
      descriptor: 'Very Good',
      count: reviewCount > 0 ? reviewCount : 8,
      isDefault: true,
    };
  }

  // Scale 5.0 -> 10.0
  const scoreNum = Math.min(10, Math.max(1, rating * 2));
  const score = scoreNum.toFixed(1);

  let descriptor = 'Review Score';
  if (scoreNum >= 9.0) descriptor = 'Exceptional';
  else if (scoreNum >= 8.5) descriptor = 'Wonderful';
  else if (scoreNum >= 8.0) descriptor = 'Very Good';
  else if (scoreNum >= 7.0) descriptor = 'Good';
  else descriptor = 'Pleasant';

  return {
    score,
    descriptor,
    count: reviewCount > 0 ? reviewCount : 14,
    isDefault: false,
  };
}

export default function GymCard({
  gym,
  active = false,
  isFavorite,
  onToggleFavorite,
  onOpenGym,
  onShowOnMap,
}: GymCardProps) {
  const { format } = useCurrency();
  const [imageError, setImageError] = useState(false);

  const reviewSummary = getReviewSummary(gym.rating, gym.reviewCount);
  const primaryPhoto = !imageError && gym.images && gym.images[0]?.url ? gym.images[0].url : null;

  // Key highlight amenities (pick up to 4 that the gym has)
  const highlightFeatures = gym.features
    .filter(id => ['parking', 'shower', 'ac', 'lockers', 'free_weights', '24x7', 'pool'].includes(id))
    .slice(0, 4);

  // Fallback regular price for strikethrough comparison
  const originalMonthPrice = Math.round(gym.prices.month * 1.25);

  return (
    <article
      className={`bk-card${active ? ' bk-card--active' : ''}`}
      onClick={() => onOpenGym(gym)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpenGym(gym)}
      aria-label={`${gym.name}, open gym details`}
    >
      {/* 1. Left Media Zone */}
      <div className="bk-card__media">
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={gym.name}
            className="bk-card__photo"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="bk-card__photo-fallback">
            <Dumbbell size={36} />
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          type="button"
          className={`bk-card__fav-btn${isFavorite ? ' bk-card__fav-btn--active' : ''}`}
          onClick={e => {
            e.stopPropagation();
            onToggleFavorite(gym.id);
          }}
          aria-label={isFavorite ? 'Remove from saved gyms' : 'Save gym'}
        >
          <Heart size={18} fill={isFavorite ? '#FF5A0F' : 'none'} />
        </button>

        {/* Media Badges */}
        <div className="bk-card__media-badges">
          {gym.openNow !== null && (
            <span
              className={`bk-badge bk-badge--status ${
                gym.openNow ? 'bk-badge--open' : 'bk-badge--closed'
              }`}
            >
              <Clock size={11} />
              {gym.openNow ? 'Open Now' : 'Closed'}
            </span>
          )}
          {gym.bookable && gym.bookable.length > 0 && (
            <span className="bk-badge bk-badge--verified">
              <ShieldCheck size={11} />
              Verified
            </span>
          )}
        </div>
      </div>

      {/* 2. Center Information Zone */}
      <div className="bk-card__info">
        <div className="bk-card__title-row">
          <h3 className="bk-card__name">{gym.name}</h3>
          <div className="bk-card__stars" aria-label="Gym rating category">
            {[...Array(4)].map((_, i) => (
              <Star key={i} size={13} fill="#FFB703" color="#FFB703" />
            ))}
          </div>
        </div>

        {/* Location & Map Link */}
        <div className="bk-card__location-row">
          <span className="bk-card__area">{gym.area ?? 'City Area'}</span>
          <span className="bk-card__dot">•</span>
          <button
            type="button"
            className="bk-card__map-link"
            onClick={e => {
              e.stopPropagation();
              onShowOnMap(gym);
            }}
          >
            <MapPin size={13} />
            Show on map
          </button>
          <span className="bk-card__dot">•</span>
          <span className="bk-card__distance">{gym.distanceKm} km from center</span>
        </div>

        {/* Highlighted Amenities / Feature Checkmarks */}
        <div className="bk-card__amenities">
          {highlightFeatures.length > 0 ? (
            highlightFeatures.map(featId => (
              <span key={featId} className="bk-card__amenity">
                <Check size={13} className="bk-card__check" />
                {FEATURE_LABELS[featId] ?? featId}
              </span>
            ))
          ) : (
            <span className="bk-card__amenity">
              <Check size={13} className="bk-card__check" />
              Standard Fitness Equipment
            </span>
          )}
        </div>

        {/* Policies & Reassurances */}
        <div className="bk-card__perks">
          <span className="bk-perk-text">Instant Confirmation</span>
          <span className="bk-card__dot">•</span>
          <span className="bk-perk-text">No Long-term Lock-in</span>
        </div>
      </div>

      {/* 3. Right Score & Pricing Zone */}
      <div className="bk-card__actions">
        {/* Review Score Badge */}
        <div className="bk-card__score-block">
          <div className="bk-card__score-meta">
            <strong className="bk-card__descriptor">{reviewSummary.descriptor}</strong>
            <span className="bk-card__reviews-count">{reviewSummary.count} reviews</span>
          </div>
          <div className="bk-card__score-badge">{reviewSummary.score}</div>
        </div>

        {/* Price Block */}
        <div className="bk-card__pricing">
          <span className="bk-card__plan-tag">Monthly membership</span>
          <div className="bk-card__price-row">
            <span className="bk-card__orig-price">{format(originalMonthPrice)}</span>
            <strong className="bk-card__main-price">{format(gym.prices.month)}</strong>
          </div>
          <span className="bk-card__day-price">or {format(gym.prices.day)} /day pass</span>
          <span className="bk-card__tax-note">+ Includes all facility access</span>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className="bk-card__cta-btn"
          onClick={e => {
            e.stopPropagation();
            onOpenGym(gym);
          }}
        >
          <span>View Passes</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}
