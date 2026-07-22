/**
 * Where the admin UI lives, given the hostname the api Worker was reached on.
 *
 * WHY: the API's friendly root page hardcoded `https://app.homeseeker.me` — a hostname with no DNS
 * record, which never answered. Anyone following that link got a dead site, and nothing would ever
 * have flagged it: a wrong link on a cosmetic page fails silently forever.
 *
 * Deriving it from the request keeps the link correct on every hostname the API answers on, and
 * means dropping or adding a domain does not leave a stale pointer behind.
 */

/** The admin that always exists. Used when the API host is not one we recognise. */
const FALLBACK_ADMIN = "https://admin.airplusauto.com";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function adminUrlForApiHost(apiHostname: string): string {
  const host = apiHostname.toLowerCase();

  // Local dev: the admin runs on its own port, not a subdomain.
  if (LOCAL_HOSTS.has(host)) return "http://localhost:3000";

  // `api.<zone>` → `admin.<zone>`, and `staging-api.<zone>` → `staging-admin.<zone>`. Matching the
  // prefix rather than listing every hostname means a new environment works without a code change.
  if (host.startsWith("api.")) return `https://admin.${host.slice("api.".length)}`;
  if (host.startsWith("staging-api.")) {
    return `https://staging-admin.${host.slice("staging-api.".length)}`;
  }

  // Anything else (a workers.dev preview, a hostname added later): a working link beats a clever
  // wrong one.
  return FALLBACK_ADMIN;
}
