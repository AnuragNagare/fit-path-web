import { requireAdmin } from './_lib/admin.js';
import { adminBookings, adminStats } from './_lib/admin/bookings.js';
import { adminGyms, adminImages } from './_lib/admin/gyms.js';
import { adminReviews } from './_lib/admin/reviews.js';
import { adminInvites, adminRegistrations } from './_lib/admin/vendors.js';
import { queryParam, type ApiRequest, type ApiResponse } from './_lib/http.js';

// One function for the whole admin area (keeps the project under Vercel's function limit):
//   /api/admin?resource=me | stats | bookings | gyms | images | reviews | invites | registrations
// Every request must come from an admin (verified email listed in ADMIN_EMAILS).
export default async function handler(req: ApiRequest, res: ApiResponse) {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  try {
    switch (queryParam(req, 'resource')) {
      case 'me': return res.status(200).json({ admin: true });
      case 'stats': return await adminStats(req, res);
      case 'bookings': return await adminBookings(req, res);
      case 'gyms': return await adminGyms(req, res, adminId);
      case 'images': return await adminImages(req, res, adminId);
      case 'reviews': return await adminReviews(req, res);
      case 'invites': return await adminInvites(req, res, adminId);
      case 'registrations': return await adminRegistrations(req, res);
      default: return res.status(404).json({ error: 'Unknown resource.' });
    }
  } catch (err) {
    console.error('admin', err instanceof Error ? err.message : err);
    res.status(502).json({ error: err instanceof Error && err.message.includes('not configured') ? err.message : 'Something went wrong. Please try again.' });
  }
}
