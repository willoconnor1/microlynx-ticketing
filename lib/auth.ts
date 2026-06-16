// Shared auth helpers — used by BOTH the edge middleware gate and the Node
// server actions, so everything here must run on the Web Crypto API (which
// exists in both runtimes) and avoid Node-only imports.

export const AUTH_COOKIE = "ml_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// The cookie never stores the password itself — it stores a SHA-256 hash of it
// (plus a fixed salt). Changing APP_PASSWORD invalidates every existing session.
const SALT = "microlynx-ticketing|v1";

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}|${SALT}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The token the cookie must match. Null when no password is configured, in
// which case the gate stays open (see middleware) so a missing env var can't
// lock the whole shop out.
export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return tokenFor(pw);
}
