import { createHash, randomBytes } from 'node:crypto';

// Registration links. The token in the link is random and only its SHA-256 hash is stored,
// so a database leak cannot be turned back into working links.

export const INVITE_DAYS = 14;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const isToken = (v: unknown): v is string => typeof v === 'string' && TOKEN.test(v);

export type InviteStatus = 'valid' | 'used' | 'expired' | 'cancelled';

export function inviteStatus(
  invite: { used_at: string | Date | null; revoked_at: string | Date | null; expires_at: string | Date },
  now: Date = new Date(),
): InviteStatus {
  if (invite.revoked_at) return 'cancelled';
  if (invite.used_at) return 'used';
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
}
