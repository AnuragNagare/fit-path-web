import { createAuthClient } from "better-auth/react";

// Neon Auth (Better Auth) endpoint — set in Neon console → Auth → Configure Auth.
const baseURL = import.meta.env["VITE_NEON_AUTH_URL"];

export const authClient = createAuthClient({
  baseURL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
