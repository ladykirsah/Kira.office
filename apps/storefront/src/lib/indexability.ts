/**
 * Which storefront hostnames search engines may index.
 *
 * WHY (2026-07-22): staging became publicly reachable once the fixed dev OTP was removed — nobody
 * can log in, but the catalogue is browsable. A public copy of the shop is duplicate content
 * competing with the real store in search results, and a customer who lands on it may try to order
 * from a database that is not the real one.
 *
 * Only the real storefront is indexable. Everything else — staging, workers.dev previews, a
 * developer's laptop — refuses twice: robots.txt AND an X-Robots-Tag header. robots.txt is
 * advisory and routinely ignored; the header is not.
 */

/** The only hosts that may appear in search results. An allow-list, never a substring match. */
const INDEXABLE_HOSTS = new Set(["airplusauto.com", "www.airplusauto.com"]);

/** Whether `hostname` is the real storefront. */
export function isIndexableHost(hostname: string): boolean {
  return INDEXABLE_HOSTS.has(hostname.toLowerCase());
}

/**
 * Sent on every response from a non-indexable host.
 *
 * `nofollow` as well as `noindex`: without it a crawler still walks staging's internal links and
 * discovers the whole tree, even while declining to index the page it started on.
 */
export const ROBOTS_NOINDEX_HEADER = "noindex, nofollow";

/**
 * robots.txt for `origin`.
 *
 * The staging body deliberately omits the Sitemap line — advertising a sitemap would invite exactly
 * the crawl this is meant to prevent.
 */
export function robotsBody(origin: string): string {
  const host = (() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return "";
    }
  })();

  if (!isIndexableHost(host)) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  return [
    "User-agent: *",
    "Allow: /",
    // Private / transactional — no SEO value, and shouldn't be indexed.
    "Disallow: /api/",
    "Disallow: /account",
    "Disallow: /checkout",
    "Disallow: /cart",
    "Disallow: /login",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
