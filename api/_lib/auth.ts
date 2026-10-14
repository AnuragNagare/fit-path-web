import { createClerkClient, verifyToken } from '@clerk/backend';
import type { ApiRequest, ApiResponse } from './http.js';

// The Clerk user id for a session token, or null when the token is invalid or expired.
export async function userIdFromToken(token: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('Server is missing CLERK_SECRET_KEY.');
  try {
    return (await verifyToken(token, { secretKey })).sub;
  } catch {
    return null;
  }
}

// Returns the Clerk user id when the request carries a valid session token; otherwise
// writes a 401 (or 500 if the server is not configured) and returns null so the handler can bail out.
export async function authUser(req: ApiRequest, res: ApiResponse): Promise<string | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    res.status(500).json({ error: 'Server is missing CLERK_SECRET_KEY.' });
    return null;
  }
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    return payload.sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return null;
  }
}

// Same check for handlers that only need to know the caller is signed in.
export async function requireUser(req: ApiRequest, res: ApiResponse): Promise<boolean> {
  return (await authUser(req, res)) !== null;
}

export type ClerkProfile = { name: string; email: string; emailVerified: boolean };

type ClerkEmail = { id: string; emailAddress: string; verification?: { status?: string } | null };
type ClerkUserLike = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: ClerkEmail[];
};

// Display name and primary email from a Clerk user (pure, so it can be tested).
export function profileFromUser(user: ClerkUserLike): ClerkProfile {
  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  const email = primary?.emailAddress ?? '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || email.split('@')[0] || 'Member';
  return { name, email, emailVerified: primary?.verification?.status === 'verified' };
}

// Loads the caller's name and email from Clerk (the session token does not carry them).
export async function getClerkProfile(userId: string): Promise<ClerkProfile> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('Server is missing CLERK_SECRET_KEY.');
  const user = await createClerkClient({ secretKey }).users.getUser(userId);
  return profileFromUser(user);
}
