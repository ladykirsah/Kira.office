/**
 * Counting failed sign-ins per CALLER, because the account lock cannot count them all.
 *
 * The account lock (three strikes, 24 hours — `roleCanBeLocked` in staffPay.ts) is keyed to an
 * account, and PIN sign-in has no account until the PIN matches one. `loginWithPin` looks the row up
 * by the PIN's peppered hash and, finding none, answers "invalid" having touched nothing. That is
 * right in itself — there is no account to punish, and punishing a guess would leak which six digits
 * are in use — but it makes every wrong guess free, and there are only 999,999 of them before the
 * millionth works.
 *
 * Harmless while Cloudflare Access stood in front of the login form: nobody could reach it without a
 * code emailed to an approved mailbox. The owner's decision of 2026-08-25 makes the Kira.office form
 * the everyday door, so the form goes on the open internet and the guesses have to be counted
 * against the only thing that exists before the account does — whoever is asking.
 *
 * Storage is `auth_throttle`, the SAME table and the same single-statement fixed-window upsert the
 * storefront's OTP limits use (`takeThrottle` in apps/storefront/src/lib/auth.ts). Deliberately not
 * a second mechanism: two rate limiters with different shapes is two things to reason about and one
 * of them will rot. Keys are namespaced `staff-login:` so the two flows cannot spend each other's
 * budget. (The two implementations are still separate code in separate apps; sharing them means
 * moving the helper into `packages/core` and repointing the storefront, which is a change to a
 * working flow that nobody asked for today.)
 *
 * WHY ONLY FAILURES ARE COUNTED. Counting every attempt would charge a counter machine for its
 * normal day — staff at one shop share one address, and a busy till signs in and out often. Failures
 * are the signal; a shop that produces twenty failed sign-ins in a quarter of an hour has a problem
 * worth pausing for either way.
 */

/**
 * Failures tolerated per caller per window.
 *
 * Twenty, not three. A real person cannot fail more than three times before their own account locks,
 * so twenty is far above honest use even for a whole shop behind one connection — while cutting a
 * six-digit PIN space from an afternoon's work to well over a year.
 */
export const STAFF_LOGIN_MAX_FAILURES = 20;

/** How long failures are remembered. Fall quiet for a window and the tally starts over. */
export const STAFF_LOGIN_WINDOW_MS = 15 * 60_000;

/** Header the admin app forwards the browser's address in, for sign-ins it proxies. */
export const FORWARDED_CLIENT_IP_HEADER = "x-kira-client-ip";

/**
 * Who is asking, for throttling purposes.
 *
 * `cf-connecting-ip` first, ALWAYS: the edge stamps it and a caller cannot forge it, so somebody
 * hitting this Worker directly — the attack this exists for — can never choose which bucket to
 * spend. The forwarded header is only consulted when the edge's is absent, which happens for the
 * admin app's server-to-server sign-in proxy, and never for a request off the internet. That
 * ordering is the whole safety argument; do not swap it for "most specific wins".
 *
 * Without the fallback every member of staff shares ONE bucket, because the API would be looking at
 * the admin Worker rather than the person — and twenty fumbles between them would shut the whole
 * shop out of its own tills while an attacker sat elsewhere.
 *
 * Neither header means local development. One shared bucket then, deliberately: the alternative is
 * a unique key per request, which is a throttle that never throttles.
 */
export function clientAddress(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get(FORWARDED_CLIENT_IP_HEADER) ??
    "unknown"
  );
}

/** Namespaced so a staff sign-in can never spend the storefront's OTP budget, or vice versa. */
export function loginThrottleKey(address: string): string {
  return `staff-login:ip:${address}`;
}

/**
 * Failures tolerated at the EMERGENCY door, per caller per window (owner, 2026-08-26).
 *
 * Five, against the everyday door's twenty. The numbers answer different questions. Twenty is what
 * a whole shop behind one address fumbles in a quarter of an hour and still deserves to be let in.
 * The emergency door is used perhaps once in a year, by one person, who is typing a key they chose
 * — five is more than they will ever need and takes a guesser from hundreds of attempts an hour to
 * under five hundred a day, against a key that is at minimum four characters.
 *
 * Not a lock, though: the window still expires. The owner's rule was slow them down, never lock —
 * because this is the door for when you are ALREADY locked out, and a rescue that can itself be
 * shut permanently by a stranger is not a rescue.
 */
export const RECOVERY_MAX_FAILURES = 5;

/**
 * Its own bucket, in both directions. A busy till must never spend the owner's rescue budget, and
 * somebody grinding away at the rescue must never shut the tills out of the shop.
 */
export function recoveryThrottleKey(address: string): string {
  return `staff-recovery:ip:${address}`;
}

/** Fixed-window bucketing, matching the storefront's `throttleWindowStart`. */
function windowStart(now: number): number {
  return now - (now % STAFF_LOGIN_WINDOW_MS);
}

/** Is this caller currently shut out? Reads only — a check must never cost an attempt. */
export async function isLoginThrottled(
  db: D1Database,
  key: string,
  now: number,
  max: number = STAFF_LOGIN_MAX_FAILURES,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT count, window_started_at AS windowStartedAt FROM auth_throttle WHERE key = ?`)
    .bind(key)
    .first<{ count: number; windowStartedAt: number }>();
  if (!row) return false;
  // A tally from a window that has passed is history, not evidence.
  if (row.windowStartedAt !== windowStart(now)) return false;
  return row.count >= max;
}

/** The same reading, against the emergency door's smaller allowance. */
export async function isRecoveryThrottled(
  db: D1Database,
  key: string,
  now: number,
): Promise<boolean> {
  return isLoginThrottled(db, key, now, RECOVERY_MAX_FAILURES);
}

/**
 * Record one failed sign-in.
 *
 * ONE statement, not a SELECT then an UPDATE: D1 serializes writes, so the increment is race-free
 * this way and quietly lossy the other way — which is exactly the shape an attacker sending
 * concurrent requests would exploit.
 */
export async function recordLoginFailure(db: D1Database, key: string, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO auth_throttle (key, count, window_started_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN auth_throttle.window_started_at = excluded.window_started_at
                      THEN auth_throttle.count + 1 ELSE 1 END,
         window_started_at = excluded.window_started_at`,
    )
    .bind(key, windowStart(now))
    .run();
}

/** Wipe a caller's tally after they sign in successfully. Fumbling then succeeding is not an attack. */
export async function clearLoginFailures(db: D1Database, key: string): Promise<void> {
  await db.prepare(`DELETE FROM auth_throttle WHERE key = ?`).bind(key).run();
}

/**
 * The 429 a shut-out caller gets, or null to carry on.
 *
 * A distinct status and a `Retry-After`, not another "email or password is wrong": someone who has
 * genuinely fumbled their way into this deserves to know they are waiting rather than failing, and
 * a guesser learns nothing from it that the wall itself does not already tell them.
 */
export async function refuseIfThrottled(
  db: D1Database,
  key: string,
  now: number,
  max: number = STAFF_LOGIN_MAX_FAILURES,
): Promise<Response | null> {
  if (!(await isLoginThrottled(db, key, now, max))) return null;
  const retryAfter = Math.ceil((windowStart(now) + STAFF_LOGIN_WINDOW_MS - now) / 1000);
  return new Response(JSON.stringify({ error: "too_many_attempts", retryAfter }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      // Whole seconds, and never zero — telling someone to come back immediately sends them
      // straight into another refusal.
      "retry-after": String(Math.max(1, retryAfter)),
    },
  });
}
