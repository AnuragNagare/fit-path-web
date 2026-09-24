import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

// Neon Auth (Better Auth) endpoint — set in Neon console → Auth → Configure Auth.
// The Neon adapter (not plain better-auth/react) is required so that the
// `neon_auth_session_verifier` query param Neon's OAuth callback appends is
// forwarded on the get-session request; without it, social sign-in redirects
// back successfully but no session is ever established.
const baseURL = import.meta.env["VITE_NEON_AUTH_URL"];

export const authClient = createAuthClient(baseURL, {
  adapter: BetterAuthReactAdapter(),
});

export const { signIn, signUp, signOut, useSession } = authClient;
