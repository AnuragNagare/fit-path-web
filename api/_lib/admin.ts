import { authUser, getClerkProfile } from './auth.js';
import type { ApiRequest, ApiResponse } from './http.js';

// Emails allowed into /admin, from the ADMIN_EMAILS env var (comma-separated, case-insensitive).
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean));
}

export function isAdminProfile(profile: { email: string; emailVerified: boolean }, admins: Set<string>): boolean {
  return profile.emailVerified && admins.has(profile.email.toLowerCase());
}

// Admin lookups are cached briefly so each admin request does not call Clerk.
const CACHE_MS = 60_000;
const cache = new Map<string, { admin: boolean; at: number }>();

export function clearAdminCache() {
  cache.clear();
}

async function userIsAdmin(userId: string): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.admin;
  const admin = isAdminProfile(await getClerkProfile(userId), parseAdminEmails(process.env.ADMIN_EMAILS));
  cache.set(userId, { admin, at: Date.now() });
  return admin;
}

// Returns the admin's Clerk user id, or null after writing 401 (not signed in) / 403 (not an admin).
export async function requireAdmin(req: ApiRequest, res: ApiResponse): Promise<string | null> {
  const userId = await authUser(req, res);
  if (!userId) return null;
  try {
    if (!(await userIsAdmin(userId))) {
      res.status(403).json({ error: 'Admin access only.' });
      return null;
    }
  } catch {
    res.status(502).json({ error: "Couldn't verify your account. Please try again." });
    return null;
  }
  return userId;
}
