import { cache } from "react";
import { cookies } from "next/headers";
import type { D1Database } from "@cloudflare/workers-types";
import {
  randomSessionToken,
  sha256Hex,
  throttleWindowStart,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SESSION_ROLL_AFTER_MS,
} from "./authCore";
import { getDb } from "./db";

/**
 * Session + request-guard layer. Sessions are D1-backed (revocable — logout-everywhere works);
 * the cookie holds the raw token, D1 holds only its SHA-256. NOTE (Next 15): cookies can only be
 * SET inside Route Handlers — server components may only read. Expiry therefore rolls in D1
 * opportunistically (when >24 h stale); the cookie's own Max-Age is fixed at issue time and the
 * server-side expiry is authoritative.
 */

export interface SessionCustomer {
  id: string;
  phone: string;
  /** '' = not captured yet (filled at first checkout; prefill, never silently overwrite). */
  name: string;
  email: string | null;
  phoneVerifiedAt: number | null;
  pdpaConsentAt: number | null;
}

export async function createSession(
  db: D1Database,
  customerId: string,
): Promise<{ token: string; expiresAt: number }> {
  const token = randomSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db
    .prepare(
      `INSERT INTO storefront_sessions (id, token_hash, customer_id, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), await sha256Hex(token), customerId, now, expiresAt, now)
    .run();
  return { token, expiresAt };
}

export async function revokeSessionByToken(db: D1Database, token: string): Promise<void> {
  await db
    .prepare(`UPDATE storefront_sessions SET revoked_at = ? WHERE token_hash = ?`)
    .bind(Date.now(), await sha256Hex(token))
    .run();
}

/** Cookie attributes for the session token. Host-only (works on *.workers.dev + custom domain). */
export function sessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    // Local next dev is plain http — a Secure cookie would be silently dropped there.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/**
 * The logged-in customer for this request, or null. React-cached so layout + page share one D1
 * read. Rolls expires_at/last_seen_at in D1 when >24 h stale (a D1 write, not a cookie write).
 */
export const getSession = cache(async (): Promise<SessionCustomer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const db = await getDb();
  const now = Date.now();
  const row = await db
    .prepare(
      `SELECT s.token_hash AS tokenHash, s.last_seen_at AS lastSeenAt,
              c.id AS id, c.phone AS phone, COALESCE(c.name, '') AS name, c.email AS email,
              c.phone_verified_at AS phoneVerifiedAt, c.pdpa_consent_at AS pdpaConsentAt
       FROM storefront_sessions s
       JOIN storefront_customers c ON c.id = s.customer_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
         AND c.status = 'active'`,
    )
    .bind(await sha256Hex(token), now)
    .first<SessionCustomer & { tokenHash: string; lastSeenAt: number }>();
  if (!row) return null;
  if (now - row.lastSeenAt > SESSION_ROLL_AFTER_MS) {
    await db
      .prepare(
        `UPDATE storefront_sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?`,
      )
      .bind(now, now + SESSION_TTL_MS, row.tokenHash)
      .run();
  }
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    phoneVerifiedAt: row.phoneVerifiedAt,
    pdpaConsentAt: row.pdpaConsentAt,
  };
});

/**
 * CSRF invariants for every mutating route handler (no token needed given these three):
 * 1. no state-changing GETs anywhere; 2. JSON Content-Type required (cross-site forms can't
 * send it without a preflight); 3. Origin, when present, must match the request host.
 * Returns a Response to send on violation, or null when the request is fine.
 */
export function guardMutation(req: Request): Response | null {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Response.json({ error: "unsupported content type" }, { status: 415 });
  }
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) {
        return Response.json({ error: "cross-origin request refused" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "cross-origin request refused" }, { status: 403 });
    }
  }
  return null;
}

/**
 * Fixed-window rate limit backed by auth_throttle. SINGLE-STATEMENT upsert — D1 serializes
 * writes, so the increment is race-free (a SELECT-then-UPDATE would not be). Returns true when
 * the request is allowed.
 */
export async function takeThrottle(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<boolean> {
  const windowStart = throttleWindowStart(now, windowMs);
  const row = await db
    .prepare(
      `INSERT INTO auth_throttle (key, count, window_started_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN auth_throttle.window_started_at = excluded.window_started_at
                      THEN auth_throttle.count + 1 ELSE 1 END,
         window_started_at = excluded.window_started_at
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

/** Client IP as seen by Cloudflare (falls back to a constant in local dev). */
export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "local-dev";
}
