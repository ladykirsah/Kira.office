/**
 * The storefront's traffic beacon — validation and the pseudonymous visitor id.
 *
 * `/api/track` is a PUBLIC, unauthenticated endpoint: anything on the internet can POST to it. So
 * everything that reaches the database is narrowed here first, against the same closed set of kinds
 * the migration's CHECK enforces, and nothing is written that we would not want to be asked about —
 * no IP, no user-agent, no query string, no referrer URL.
 *
 * See `packages/db/migrations/0087_storefront_events.sql` for the privacy rationale in full.
 */

/** The event kinds — must stay identical to the CHECK in migration 0087. */
export const TRACK_KINDS = [
  "page_view",
  "product_view",
  "click",
  "add_to_cart",
  "checkout_start",
] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

export interface TrackEventInput {
  kind: TrackKind;
  path: string | null;
  productId: string | null;
  /**
   * `document.referrer` as the BROWSER saw it — where the visitor came from.
   *
   * It has to travel in the body. The request's own `Referer` header on a beacon POST names the page
   * that sent it, which is always one of ours, so classifying that would file every arrival on earth
   * as "internal" and leave the traffic-source table permanently empty. Client-supplied and
   * therefore forgeable, which is the accepted trade every analytics tool makes: it is classified
   * into one of six buckets and then DISCARDED — the raw URL never reaches the database, because a
   * referrer can carry the search terms someone typed.
   */
  referrer: string | null;
}

/** Long enough for any real storefront route, short enough that nobody can post a novel. */
const MAX_PATH = 256;
/** Referrers are URLs from the wider web, so they run longer than our own paths — but not unboundedly. */
const MAX_REFERRER = 512;

/**
 * The path component of a URL or path-like string, with the query and hash removed.
 *
 * Dropping the query is the point, not a tidy-up: `/search?q=…` carries what a visitor typed, which
 * is theirs. Relative input is resolved against a throwaway base so a bare "/products/x" parses.
 *
 * The decode check is doing real work. `new URL` is deliberately lenient — it happily accepts "%%%"
 * and hands back "/%%%" — so parsing alone is not proof of a usable path. Anything whose escapes
 * don't decode is junk or an attempt at one, and it is rejected here rather than stored and puzzled
 * over later in a traffic report.
 */
export function safePath(value: string): string | null {
  try {
    const { pathname } = new URL(value, "https://airplus.invalid");
    decodeURIComponent(pathname);
    return pathname.slice(0, MAX_PATH);
  } catch {
    return null;
  }
}

function isTrackKind(value: unknown): value is TrackKind {
  return typeof value === "string" && (TRACK_KINDS as readonly string[]).includes(value);
}

/**
 * Narrow an untrusted beacon body, or null when it is not usable.
 *
 * A bad `kind` is the only fatal problem — it is what the CHECK constraint would reject, and we would
 * rather answer 400 than hand D1 a row it will refuse. A bad path or productId is merely dropped:
 * the visit itself still happened and still deserves to be counted, just without that detail.
 */
export function parseTrackBody(raw: unknown): TrackEventInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  if (!isTrackKind(body.kind)) return null;
  return {
    kind: body.kind,
    path: typeof body.path === "string" ? safePath(body.path) : null,
    productId: typeof body.productId === "string" ? body.productId.slice(0, 64) : null,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, MAX_REFERRER) : null,
  };
}

/**
 * A visitor id that is stable for one Bangkok day and meaningless after it.
 *
 * Derived rather than issued: no cookie to set, no localStorage to read, nothing for the visitor to
 * carry. Because `dayStart` is part of the digest, the same person gets a different id tomorrow —
 * which is exactly what makes this safe to collect without a consent banner, and exactly why
 * multi-day visitor counts are sums of daily uniques rather than deduplicated people (documented on
 * the tile, and in migration 0087).
 *
 * Truncated to 128 bits: still far beyond collision range for a shop's daily traffic, and half the
 * row width of a full SHA-256.
 */
export async function visitorHash(
  dayStart: number,
  ip: string,
  userAgent: string,
  salt: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${dayStart}|${ip}|${userAgent}|${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
