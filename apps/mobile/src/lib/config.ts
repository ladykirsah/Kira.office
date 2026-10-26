/**
 * Where the API lives. EXPO_PUBLIC_* is baked into the bundle when it is built — the same trap that
 * once shipped a localhost API base to production for 16 hours (docs/knowledge/operations/
 * next-public-env-trap.md) — so the production address is the default and a local preview has to
 * opt in with apps/mobile/.env.local.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://api.airplusauto.com";

/** Same rule as the web back office's practice copy: only an API on this machine offers one-click. */
export function isLocalApi(base: string): boolean {
  try {
    const host = new URL(base).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}
