import { rows } from './db.js';
import { ratingStats } from './gym-data.js';
import { changedFields, deriveState, emptyProfile, normalizeProfile, submitProblems, type VendorProfile, type VendorState, type VendorStatus } from './vendor-model.js';

export type VendorGymRow = {
  id: string;
  owner_clerk_id: string;
  owner_name: string;
  owner_email: string;
  status: VendorStatus;
  live: unknown;
  live_lat: number | null;
  live_lon: number | null;
  draft: unknown;
  draft_submitted_at: string | Date | null;
  review_note: string | null;
  approved_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export const VENDOR_COLUMNS =
  'id, owner_clerk_id, owner_name, owner_email, status, live, live_lat, live_lon, draft, draft_submitted_at, review_note, approved_at, created_at, updated_at';

export type MediaRow = {
  id: string;
  gym_id: string;
  kind: 'photo' | 'video';
  url: string;
  content_type: string;
  size_bytes: number;
  alt: string | null;
  status: 'approved' | 'pending_add' | 'pending_remove';
};

export const MEDIA_COLUMNS = 'id, gym_id, kind, url, content_type, size_bytes, alt, status';

export async function findGymByOwner(userId: string): Promise<VendorGymRow | null> {
  const [row] = await rows<VendorGymRow>(`SELECT ${VENDOR_COLUMNS} FROM vendor_gyms WHERE owner_clerk_id = $1`, [userId]);
  return row ?? null;
}

export async function findGymById(id: string): Promise<VendorGymRow | null> {
  const [row] = await rows<VendorGymRow>(`SELECT ${VENDOR_COLUMNS} FROM vendor_gyms WHERE id = $1`, [id]);
  return row ?? null;
}

export function loadMedia(gymId: string): Promise<MediaRow[]> {
  return rows<MediaRow>(`SELECT ${MEDIA_COLUMNS} FROM vendor_media WHERE gym_id = $1 ORDER BY position, created_at`, [gymId]);
}

export async function reviewSummary(gymId: string) {
  const [s] = await rows<{ sum: string | null; n: string }>('SELECT sum(rating) AS sum, count(*) AS n FROM reviews WHERE gym_id = $1 AND NOT hidden', [gymId]);
  return ratingStats(Number(s?.sum ?? 0), Number(s?.n ?? 0));
}

export type MediaState = 'live' | 'pending_add' | 'pending_remove';

export type MediaView = { id: string; kind: 'photo' | 'video'; url: string; alt: string | null; sizeBytes: number; state: MediaState };

const mediaView = (m: MediaRow): MediaView => ({
  id: m.id, kind: m.kind, url: m.url, alt: m.alt, sizeBytes: m.size_bytes, state: m.status === 'approved' ? 'live' : m.status,
});

export type VendorView = {
  id: string;
  state: VendorState;
  status: VendorStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  live: VendorProfile | null; // null until the first approval
  draft: VendorProfile;
  media: MediaView[];
  hasChanges: boolean; // the draft or its media differ from what is live
  problems: string[]; // what is still missing before it can be submitted
  rating: number | null;
  reviewCount: number;
};

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

// Photos that would be on the gym page if the draft were approved now.
export const draftPhotoCount = (media: MediaRow[]) => media.filter(m => m.kind === 'photo' && m.status !== 'pending_remove').length;

export function buildView(gym: VendorGymRow, media: MediaRow[], stats: { rating: number | null; reviewCount: number }): VendorView {
  const draft = normalizeProfile(gym.draft);
  const live = gym.live ? normalizeProfile(gym.live) : null;
  return {
    id: gym.id,
    state: deriveState(gym),
    status: gym.status,
    reviewNote: gym.review_note,
    submittedAt: iso(gym.draft_submitted_at),
    approvedAt: iso(gym.approved_at),
    live,
    draft,
    media: media.map(mediaView),
    hasChanges: changedFields(live, draft).length > 0 || media.some(m => m.status !== 'approved'),
    problems: submitProblems(draft, draftPhotoCount(media)),
    rating: stats.rating,
    reviewCount: stats.reviewCount,
  };
}

export async function loadView(gym: VendorGymRow): Promise<VendorView> {
  const [media, stats] = await Promise.all([loadMedia(gym.id), reviewSummary(gym.id)]);
  return buildView(gym, media, stats);
}

export { emptyProfile };
