/**
 * Back-office staff sessions — the API's own gate, replacing Cloudflare Access.
 *
 * WHY THE API AND NOT JUST THE ADMIN APP: api.airplusauto.com is a separate public hostname. If
 * sessions were only checked inside the admin Next app, then the moment Access comes off the edge
 * the API would be answering to anyone who typed its URL. The admin app forwards the session token;
 * the API is what decides.
 *
 * FAILS CLOSED, ALWAYS. The gate this replaces (`requireAccess`) returned an open `{email: null}`
 * whenever ACCESS_* was unset, and `viewerRole()` read an unconfigured environment as super_admin.
 * That is the single most dangerous shape in the old code and it is not reproduced here: every path
 * out of `requireStaff` that is not a live, unexpired, unrevoked session belonging to an active user
 * with a known role is a 401.
 */
import {
  isLocked,
  isStaffRole,
  nextLockState,
  pinLookup,
  randomSessionToken,
  sha256Hex,
  verifyPassword,
  type LockState,
} from "@l-shopee/core";
import type { StaffRole } from "@l-shopee/core";

/** Header the admin app forwards the raw session token in. The cookie itself lives on the admin origin. */
export const STAFF_SESSION_HEADER = "X-Staff-Session";

export const STAFF_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Only touch the row when a session is at least this stale — one write per day, not per request. */
export const SESSION_ROLL_AFTER_MS = 24 * 60 * 60 * 1000;

export interface StaffIdentity {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: number; identity: StaffIdentity }
  | { ok: false; reason: "invalid" | "locked" };

export async function createStaffSession(
  db: D1Database,
  userId: string,
  now: number,
): Promise<{ token: string; expiresAt: number }> {
  const token = randomSessionToken();
  const expiresAt = now + STAFF_SESSION_TTL_MS;
  await db
    .prepare(
      `INSERT INTO staff_sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), await sha256Hex(token), userId, now, expiresAt, now)
    .run();
  return { token, expiresAt };
}

/**
 * Who this token belongs to, or null. Every condition below is part of the security boundary:
 * revoked sessions, expired sessions, deactivated people and unrecognised roles all resolve to
 * nobody — so "remove this person" takes effect on their next request, not at their next login.
 */
export async function staffFromToken(
  db: D1Database,
  token: string,
  now: number,
): Promise<StaffIdentity | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id AS userId, u.email AS email, u.name AS name, u.role AS role,
              s.id AS sessionId, s.last_seen_at AS lastSeenAt
         FROM staff_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > ?
          AND u.status = 'active'`,
    )
    .bind(await sha256Hex(token), now)
    .first<{
      userId: string;
      email: string;
      name: string;
      role: string;
      sessionId: string;
      lastSeenAt: number;
    }>();
  if (!row) return null;
  // A role we don't recognise is not a role. Refuse rather than fall back to some default, which is
  // how a typo or a half-finished migration turns into an accidental promotion.
  if (!isStaffRole(row.role)) return null;

  // Keep an active session alive, but write at most once a day.
  if (now - row.lastSeenAt > SESSION_ROLL_AFTER_MS) {
    await db
      .prepare(`UPDATE staff_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?`)
      .bind(now, now + STAFF_SESSION_TTL_MS, row.sessionId)
      .run();
  }
  return { userId: row.userId, email: row.email, name: row.name, role: row.role };
}

export async function revokeStaffSession(
  db: D1Database,
  token: string,
  now: number,
): Promise<void> {
  await db
    .prepare(`UPDATE staff_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
    .bind(now, await sha256Hex(token))
    .run();
}

/** Log every device out — used when a password is reset or someone is removed. */
export async function revokeAllStaffSessions(
  db: D1Database,
  userId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(`UPDATE staff_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(now, userId)
    .run();
}

/**
 * Email + password → a session, or a deliberately vague failure.
 *
 * ONE COUNTER FOR BOTH DOORS. The owner's rule is three failures — PIN or password, counted
 * together — then a 24-hour lock nobody can lift. So this shares `users.failed_attempts` with
 * `loginWithPin` rather than keeping its own throttle; two separate counters would have meant six
 * effective attempts, which is not what was asked for.
 *
 * "No such email" and "wrong password" return the IDENTICAL failure, so the form cannot be used to
 * discover which addresses are staff. An email nobody holds locks nothing — there is no account to
 * lock, and guessing addresses reveals nothing either way.
 */
export async function loginStaff(
  db: D1Database,
  email: string,
  password: string,
  now: number,
): Promise<LoginResult> {
  const normalized = email.trim().toLowerCase();

  const row = await db
    .prepare(
      `SELECT id, name, email, role, status, deleted_at AS deletedAt,
              password_hash AS hash, password_salt AS salt, password_iterations AS iterations,
              failed_attempts AS failedAttempts, locked_until AS lockedUntil,
              last_failed_at AS lastFailedAt
         FROM users
        WHERE lower(email) = ?`,
    )
    .bind(normalized)
    .first<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      deletedAt: number | null;
      hash: string | null;
      salt: string | null;
      iterations: number | null;
      failedAttempts: number;
      lockedUntil: number | null;
      lastFailedAt: number | null;
    }>();

  if (!row) return { ok: false, reason: "invalid" };

  if (isLocked(lockStateOf(row), now)) {
    return { ok: false, reason: "locked" };
  }
  if (row.status !== "active" || row.deletedAt !== null) return { ok: false, reason: "invalid" };

  const good =
    isStaffRole(row.role) &&
    (await verifyPassword(password, {
      hash: row.hash,
      salt: row.salt,
      iterations: row.iterations,
    }));

  if (!good) {
    await recordAccountFailure(db, row.id, lockStateOf(row), now);
    return { ok: false, reason: "invalid" };
  }

  await clearAccountFailures(db, row.id, now);
  const { token, expiresAt } = await createStaffSession(db, row.id, now);
  return {
    ok: true,
    token,
    expiresAt,
    identity: { userId: row.id, email: row.email, name: row.name, role: row.role as StaffRole },
  };
}

/** The identity behind this request, or a 401 Response. There is no third outcome. */
export async function requireStaff(
  request: Request,
  env: { DB?: D1Database },
): Promise<StaffIdentity | Response> {
  const unauthorized = () =>
    new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  // No database binding means we cannot verify anybody. That is a refusal, never a pass.
  if (!env.DB) return unauthorized();
  const token = request.headers.get(STAFF_SESSION_HEADER);
  if (!token) return unauthorized();
  const identity = await staffFromToken(env.DB, token, Date.now());
  return identity ?? unauthorized();
}

/**
 * Sign in with a 6-digit PIN and nothing else (owner's design, 2026-08-03).
 *
 * With no email typed, the PIN has to find the person before it can prove who they are. That is a
 * two-step job and both steps matter:
 *   1. `pin_lookup` — a peppered HMAC with a UNIQUE index — narrows a million possibilities to at
 *      most one row. It is fast, and useless to anyone holding the database without the pepper.
 *   2. The slow PBKDF2 `pin_hash` on that row is what actually authorises. Skipping it and trusting
 *      step 1 would make the whole lock an unsalted digest of six digits.
 *
 * The account lock (3 strikes, 24 h) is checked and applied against the row the PIN found. A PIN
 * matching nobody can't lock an account — there is none to lock — so those attempts are counted by
 * the caller against the device instead.
 */
export async function loginWithPin(
  db: D1Database,
  pin: string,
  now: number,
  pepper: string,
): Promise<LoginResult | { ok: false; reason: "locked" }> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, reason: "invalid" };

  const row = await db
    .prepare(
      `SELECT id, name, email, role, status, deleted_at AS deletedAt,
              pin_hash AS hash, pin_salt AS salt, pin_iterations AS iterations,
              failed_attempts AS failedAttempts, locked_until AS lockedUntil,
              last_failed_at AS lastFailedAt
         FROM users
        WHERE pin_lookup = ?`,
    )
    .bind(await pinLookup(pin, pepper))
    .first<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      deletedAt: number | null;
      hash: string | null;
      salt: string | null;
      iterations: number | null;
      failedAttempts: number;
      lockedUntil: number | null;
      lastFailedAt: number | null;
    }>();

  // Nobody holds this PIN. Same answer as a wrong one — the form must not reveal which six digits
  // are in use.
  if (!row) return { ok: false, reason: "invalid" };

  if (isLocked(lockStateOf(row), now)) {
    return { ok: false, reason: "locked" };
  }
  // A person who has left, or been switched off, keeps neither their PIN nor their password.
  if (row.status !== "active" || row.deletedAt !== null) return { ok: false, reason: "invalid" };
  if (!isStaffRole(row.role)) return { ok: false, reason: "invalid" };

  const good = await verifyPassword(pin, {
    hash: row.hash,
    salt: row.salt,
    iterations: row.iterations,
  });
  if (!good) {
    await recordAccountFailure(db, row.id, lockStateOf(row), now);
    return { ok: false, reason: "invalid" };
  }

  await clearAccountFailures(db, row.id, now);
  const { token, expiresAt } = await createStaffSession(db, row.id, now);
  return {
    ok: true,
    token,
    expiresAt,
    identity: { userId: row.id, email: row.email, name: row.name, role: row.role as StaffRole },
  };
}

/** Pull the three lock columns off a row, so no caller forgets `lastFailedAt` and breaks the run. */
function lockStateOf(row: {
  failedAttempts: number;
  lockedUntil: number | null;
  lastFailedAt: number | null;
}): LockState {
  return {
    failedAttempts: row.failedAttempts,
    lockedUntil: row.lockedUntil,
    lastFailedAt: row.lastFailedAt,
  };
}

/** One more strike. The third INSIDE THE WINDOW sets the 24-hour lock; an older miss starts over. */
export async function recordAccountFailure(
  db: D1Database,
  userId: string,
  state: LockState,
  now: number,
): Promise<void> {
  const next = nextLockState(state, now);
  await db
    .prepare(
      `UPDATE users SET failed_attempts = ?, locked_until = ?, last_failed_at = ? WHERE id = ?`,
    )
    .bind(next.failedAttempts, next.lockedUntil, next.lastFailedAt, userId)
    .run();
}

/** A clean sign-in wipes the slate, so yesterday's typo can't combine with today's. */
export async function clearAccountFailures(
  db: D1Database,
  userId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_failed_at = NULL,
                        last_login_at = ?
        WHERE id = ?`,
    )
    .bind(now, userId)
    .run();
}
