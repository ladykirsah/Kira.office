import { bangkokDayStart, trafficSource } from "@l-shopee/core";
import { getDb } from "@/lib/db";
import { parseTrackBody, visitorHash } from "@/lib/trackEvent";

/**
 * POST /api/track — the storefront's traffic beacon.
 *
 * Body: { kind, path?, productId? }. Always answers 204 with an empty body; the caller uses
 * `navigator.sendBeacon`, which cannot read a response and must not be made to wait for one.
 *
 * Three deliberate properties:
 *
 * **It never breaks a page.** Every failure path — bad body, missing binding, a D1 write that
 * refuses — is swallowed and answered 204. Analytics is the least important thing on this site; a
 * visitor must never see a broken page, or a slower one, because a metric could not be recorded.
 * Errors go to the log, not to the customer.
 *
 * **It stores no identifiers.** The IP and user-agent are read from the request to derive a
 * day-scoped hash and then dropped; the referrer is classified into one of six buckets and dropped.
 * Nothing that reaches the table can be traced to a person or followed to tomorrow. See migration
 * 0087 for the full rationale.
 *
 * **It trusts nothing from the client.** The timestamp is the server's, the source is derived from
 * the real `Referer` header rather than anything in the body, and the kind is checked against the
 * same closed set the table's CHECK constraint holds.
 */

/** 204, no body — the only response this endpoint ever gives, success or failure alike. */
const NO_CONTENT = new Response(null, { status: 204 });

/**
 * A salt so the stored hash cannot be brute-forced back to an IP by anyone who obtains the table.
 * Without one, the space of IPv4 addresses is small enough to enumerate against a known day and
 * user-agent, which would undo the whole pseudonymity argument. Falls back to a constant when the
 * secret is unset so local development still records events — the fallback is not a security
 * control and is not meant to be one.
 */
function saltFor(env: Record<string, unknown>): string {
  const secret = env.TRACK_SALT;
  return typeof secret === "string" && secret ? secret : "airplus-dev-salt";
}

export async function POST(req: Request): Promise<Response> {
  try {
    const event = parseTrackBody(await req.json().catch(() => null));
    if (!event) return NO_CONTENT;

    const now = Date.now();
    // Cloudflare's CF-Connecting-IP is the real client address; the header is set by the edge and
    // cannot be spoofed by the client. Absent only in local dev, where every visitor shares "local".
    const ip = req.headers.get("CF-Connecting-IP") ?? "local";
    const userAgent = req.headers.get("user-agent") ?? "";
    const origin = new URL(req.url).origin;

    const db = await getDb();
    const { env } = (await import("@opennextjs/cloudflare")).getCloudflareContext();
    const hash = await visitorHash(
      bangkokDayStart(now),
      ip,
      userAgent,
      saltFor(env as unknown as Record<string, unknown>),
    );

    await db
      .prepare(
        `INSERT INTO storefront_events (id, occurred_at, kind, visitor_hash, source, path, product_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        now,
        event.kind,
        hash,
        // The body's referrer, NOT this request's Referer header — that header names the page that
        // sent the beacon, which is always ours, so it would classify every visit as internal.
        // Classified here and immediately discarded; the URL itself is never stored.
        trafficSource(event.referrer, origin),
        event.path,
        event.productId,
      )
      .run();

    return NO_CONTENT;
  } catch (err) {
    // Logged, never surfaced. A dropped metric is a rounding error; a failed page is a lost sale.
    console.error("POST /api/track failed", err);
    return NO_CONTENT;
  }
}
