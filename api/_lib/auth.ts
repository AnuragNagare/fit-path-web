import { verifyToken } from '@clerk/backend';
import type { ApiRequest, ApiResponse } from './http.js';

// Returns true when the request carries a valid Clerk session token; otherwise
// writes a 401 and returns false so the handler can bail out.
export async function requireUser(req: ApiRequest, res: ApiResponse): Promise<boolean> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    res.status(500).json({ error: 'Server is missing CLERK_SECRET_KEY.' });
    return false;
  }
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return false;
  }

  try {
    await verifyToken(token, { secretKey });
    return true;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return false;
  }
}
