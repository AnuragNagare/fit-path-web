export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface SearchQuery {
  place: Place; // the typed area, or the user's location ("My location")
  people: number;
}

// Gym as returned by /api/gyms and /api/gym (real OpenStreetMap data).
export interface Gym {
  id: string; // e.g. "node-123456"
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  area: string | null; // suburb or city
  distanceKm: number; // distance from the search point
  hours: string | null;
  openNow: boolean | null; // null when opening hours are unknown
  phone: string | null;
  website: string | null;
  features: string[]; // feature ids (see src/data/features.ts)
  description: string | null; // written by the admin
  images: GymMedia[]; // photos
  videos: GymMedia[];
  prices: Record<Plan, number>; // INR; a sample price where the gym has not set a real one
  bookable: Plan[]; // plans with a real price (only these can be booked)
  rating: number | null; // from real reviews
  reviewCount: number;
}

export interface GymMedia {
  id: string;
  kind: 'photo' | 'video';
  url: string; // ready for <img src> or <video src>
  alt: string | null;
}

export type Plan = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';

export interface Booking {
  id: string;
  gymId: string;
  gymName: string;
  plan: Plan;
  startDate: string; // YYYY-MM-DD, set automatically to the day of booking
  endDate: string; // inclusive
  people: number;
  amountInr: number;
  status: 'booked' | 'cancelled';
  paymentStatus: 'due' | 'paid' | 'refunded';
  createdAt: string;
}

export interface Review {
  id: string;
  userName: string; // first name only
  rating: number;
  body: string | null;
  createdAt: string;
  mine: boolean;
}

export interface ReviewsResult {
  reviews: Review[];
  summary: { rating: number | null; reviewCount: number };
  canReview: boolean; // has a booking at this gym
  mine: { id: string; rating: number; body: string | null; hidden: boolean } | null;
}

export interface SearchResult {
  gyms: Gym[];
}

// ── Gym owners (vendors) ──

export interface VendorProfile {
  name: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  description: string | null;
  features: string[];
  prices: Partial<Record<Plan, number>>;
}

export type VendorState = 'draft' | 'changes_requested' | 'waiting' | 'live' | 'live_pending' | 'suspended';

export interface VendorMedia {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  alt: string | null;
  sizeBytes: number;
  state: 'live' | 'pending_add' | 'pending_remove';
}

export interface VendorGym {
  id: string;
  state: VendorState;
  status: 'new' | 'pending' | 'live' | 'suspended';
  reviewNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  live: VendorProfile | null; // null until the first approval
  draft: VendorProfile;
  media: VendorMedia[];
  hasChanges: boolean;
  problems: string[]; // what is still missing before it can be submitted
  rating: number | null;
  reviewCount: number;
}

export interface VendorBooking {
  id: string;
  userName: string;
  plan: Plan;
  startDate: string;
  endDate: string;
  people: number;
  amountInr: number;
  status: 'booked' | 'cancelled';
  paymentStatus: 'due' | 'paid' | 'refunded';
  createdAt: string;
}

export type InviteCheck = { status: 'valid' | 'used' | 'expired' | 'cancelled' | 'unknown'; label?: string };
