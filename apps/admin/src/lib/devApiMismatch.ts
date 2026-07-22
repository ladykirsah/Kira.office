/**
 * Detects the one dev setup that looks exactly like data loss.
 *
 * WHY (2026-07-22): the owner spent a session convinced production data had disappeared. Three
 * admin pages looked broken — "Failed to load shop info (HTTP 401)", "No values yet", "Add a brand
 * to get started" — while production actually held 9 part brands, 10 car brands and 106 car models.
 *
 * They were on a local dev server. It proxies to the PRODUCTION API, which requires a Cloudflare
 * Access token; localhost sits outside Access, so every request 401s. Worse, most pages render an
 * empty state rather than an error, so a failed fetch is indistinguishable from an empty database.
 *
 * A banner costs nothing and removes an entire category of false alarm.
 */

/** Hostnames that mean "this is a developer's machine", not a deployed environment. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isLocal(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith(".local");
}

/**
 * A warning to show, or null when the setup is fine.
 *
 * Fine means either: the admin is deployed (Access supplies the token), or it is local AND talking
 * to a local API (which runs with Access unconfigured, so `requireAccess` deliberately opens).
 * Only local-admin → remote-API is broken, and it is broken 100% of the time, not intermittently.
 *
 * Returns null on a malformed apiBase: a banner must never be the thing that breaks the page it is
 * warning about.
 */
export function describeApiMismatch(pageHostname: string, apiBase: string): string | null {
  if (!isLocal(pageHostname)) return null;

  let apiHost: string;
  try {
    apiHost = new URL(apiBase).hostname;
  } catch {
    return null;
  }
  if (isLocal(apiHost)) return null;

  return (
    `Dev mode: this admin is running locally but calling the REMOTE API at ${apiHost}, ` +
    `which requires a Cloudflare Access login. Local pages cannot get that token, so every ` +
    `request returns 401 — lists will look empty even when the data exists. ` +
    `Use https://admin.airplusauto.com for real data, or run a local API and set ` +
    `NEXT_PUBLIC_API_BASE to it.`
  );
}
