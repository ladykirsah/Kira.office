/**
 * Staff administration — create people, set their password, change their role, switch them off.
 *
 * Every handler re-checks `canManageStaff` itself rather than trusting the router to have done it.
 * That is deliberate duplication: a route added later that forgets the check should still be safe.
 *
 * Owner's rules (2026-08-03, revised during the preview):
 *  · The super admin can READ any staff password back at any time — `revealPassword`. That works
 *    off a second, encrypted copy of the password, never the one-way hash.
 *  · Staff may change their own password and PIN, and every such change is written to
 *    `staff_activity` so the owner sees it ("all changes update to me").
 *  · Days off are self-reported with no approval step.
 */
import {
  canManageStaff,
  decryptSecret,
  encryptSecret,
  hashPassword,
  isStaffRole,
  passwordProblem,
  pinLookup,
  pinProblem,
  recoveryKeyProblem,
  recoveryLookup,
  canUseRecoveryKey,
  payForMonth,
  daysInMonth,
  slipIsExpired,
  isLeaveHalves,
  leaveModeLabel,
  payoutProblem,
  settleMonth,
} from "@l-shopee/core";
import type { StaffIdentity } from "./staffSession";
import { revokeAllStaffSessions } from "./staffSession";
import { logActivity } from "./staffActivityLog";

/**
 * The add form. Two senders: the old admin page ({name, email, role, password, nameTh, nameEn}) and
 * the Expo add form, which sends the whole person and never `name`.
 */
export interface CreateStaffInput {
  /** The old admin page's display name. The Expo form leaves it out; `nameTh` then becomes it. */
  name?: string;
  /** ชื่อเล่น — the nicknames, Thai and English (name_th / name_en, the taxonomy convention). */
  nameTh?: string | null;
  nameEn?: string | null;
  /** ชื่อจริง — the real full name, Thai and English. */
  fullNameTh?: string | null;
  fullNameEn?: string | null;
  /** Optional. Blank means none — the person then signs in by PIN alone, so a PIN is required. */
  email?: string | null;
  phone?: string | null;
  emergencyName?: string | null;
  /** เกี่ยวข้องเป็น — e.g. แม่. */
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  role?: string;
  dayRateSatang?: number | null;
  /** Epoch ms of the start day at 00:00 UTC — the same value the profile edit stores. */
  startedOn?: number | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  /** Only with an email: without one a password can never be typed anywhere. */
  password?: string;
  /** Six digits, as a string. Required when there is no email. */
  pin?: string;
}
export interface UpdateStaffInput {
  role?: string;
  status?: string;
  /** Day rate in satang. Null clears it, which takes the person out of the salary run. */
  dayRateSatang?: number | null;
}

/**
 * The CORS and security headers index.ts builds for the request in hand. The old back office reads
 * these routes through its same-origin relay, but the Expo app reads them straight from the API, and
 * without the CORS headers the browser drops every reply.
 */
let replyHeaders: Record<string, string> = {};

export function setReplyHeaders(headers: Record<string, string>): void {
  replyHeaders = headers;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...replyHeaders, "content-type": "application/json" },
  });

const forbidden = () => json({ error: "forbidden", reason: "super_admin_only" }, 403);

/**
 * A refusal the app can put under the right box: a stable `error` code to map to its own words,
 * the `field` it belongs to (the request's field name), and an English `message` for anything that
 * just shows the text.
 */
const fieldError = (status: number, error: string, field: string | null, message: string) =>
  json({ error, field, message }, status);

/** A text box's value: trimmed, and blank stored as NULL rather than as an empty string. */
const cleanText = (v: unknown): string | null => (typeof v === "string" ? v.trim() || null : null);

/** Which unique index a failed write tripped, if any — the race the pre-checks cannot close. */
const uniqueClash = (err: unknown): "email" | "pin" | null => {
  const text = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed: users\.email/.test(text)) return "email";
  if (/UNIQUE constraint failed: users\.pin_lookup/.test(text)) return "pin";
  return null;
};

const emailTaken = () =>
  fieldError(409, "email_taken", "email", "that email already has an account");

/** How many active super admins remain — the number that must never reach zero. */
async function activeSuperAdmins(db: D1Database, excludingUserId?: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM users
        WHERE role = 'super_admin' AND status = 'active' AND id <> ?`,
    )
    .bind(excludingUserId ?? "")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listStaff(db: D1Database, actor: StaffIdentity): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  // Columns are named explicitly: SELECT * here would start leaking password_hash the moment
  // someone adds a column, and this response goes to a browser.
  const { results } = await db
    .prepare(
      `SELECT id, name, name_th AS nameTh, name_en AS nameEn,
              full_name_th AS fullNameTh, full_name_en AS fullNameEn,
              email, phone, emergency_relation AS emergencyRelation,
              role, status, created_at AS createdAt,
              last_login_at AS lastLoginAt,
              -- ล็อกอยู่ while this is in the future (three failed sign-ins in a row).
              locked_until AS lockedUntil,
              day_rate_satang AS dayRateSatang,
              -- WHETHER there is a photo, PIN or password — never the key or the material itself.
              CASE WHEN photo_key IS NULL THEN 0 ELSE 1 END AS hasPhoto,
              CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END AS hasPin,
              CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword
         FROM users
        WHERE deleted_at IS NULL
        ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, name`,
    )
    .all();
  return json({ staff: results ?? [] });
}

/**
 * Add a person — the whole add form, saved by ONE insert, PIN included.
 *
 * One insert rather than "insert, then set the PIN": a person saved without the PIN they were
 * given would be an account with no way in, and a retry would then trip over the half-saved row.
 *
 * Email is optional (0097). Without one the person signs in by PIN alone, so a PIN is required and
 * a password is refused — with no email there is no box a password could ever be typed into.
 *
 * Every refusal is a `fieldError`, so the app can put it under the box it belongs to.
 */
export async function createStaff(
  db: D1Database,
  actor: StaffIdentity,
  input: CreateStaffInput,
  now: number,
  pepper = "",
  key = "",
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();

  // The old admin page always sends `name`, the Expo form never does. Only the Expo form has a
  // phone box, so only it is held to the phone rule — the old page keeps working as it was.
  const isAppForm = input.name === undefined;
  const nameTh = cleanText(input.nameTh);
  const name = cleanText(input.name) ?? nameTh;
  if (!name) return fieldError(400, "name_th_required", "nameTh", "Enter their nickname.");
  const phone = cleanText(input.phone);
  if (isAppForm && !phone) {
    return fieldError(400, "phone_required", "phone", "Enter a phone number.");
  }
  const role = input.role ?? "";
  if (!isStaffRole(role)) return fieldError(400, "role_invalid", "role", "Choose a role.");
  const dayRate = input.dayRateSatang ?? null;
  if (dayRate !== null && (!Number.isInteger(dayRate) || dayRate < 0)) {
    return fieldError(
      400,
      "day_rate_invalid",
      "dayRateSatang",
      "day rate must be a whole number of satang",
    );
  }
  const startedOn = input.startedOn ?? null;
  if (startedOn !== null && !Number.isInteger(startedOn)) {
    return fieldError(400, "started_on_invalid", "startedOn", "Pick a start date.");
  }

  const email = cleanText(input.email)?.toLowerCase() ?? null;
  const pin = input.pin == null || input.pin === "" ? null : String(input.pin).trim();
  const password = input.password ?? "";
  if (!email && password) {
    return fieldError(
      400,
      "password_without_email",
      "password",
      "A password needs an email to sign in with.",
    );
  }
  if (!email && !pin) {
    return fieldError(
      400,
      "pin_required_without_email",
      "pin",
      "Without an email they sign in by PIN — set one.",
    );
  }
  // A password is optional at creation — the account simply can't be logged into with one until
  // it is set, which `verifyPassword` enforces by refusing a null hash.
  if (password) {
    const problem = passwordProblem(password);
    if (problem) return fieldError(400, "password_too_short", "password", problem);
  }

  if (email) {
    const existing = await db
      .prepare(`SELECT id FROM users WHERE lower(email) = ?`)
      .bind(email)
      .first<{ id: string }>();
    if (existing) return emailTaken();
  }

  let pinColumns: Extract<PreparedPin, { ok: true }>["columns"] | null = null;
  if (pin) {
    const prepared = await preparePin(db, null, pin, pepper, key);
    if (!prepared.ok) {
      const status =
        prepared.code === "pin_unavailable" ? 503 : prepared.code === "pin_taken" ? 409 : 400;
      return fieldError(status, prepared.code, "pin", prepared.message);
    }
    pinColumns = prepared.columns;
  }

  const stored = password
    ? await hashPassword(password)
    : { hash: null, salt: null, iterations: null };
  // The readable copy the owner reveals later, as setStaffPassword keeps — without it a password
  // set here could never be read back. No key configured → no readable copy; login still works.
  const passwordCipher = password && key ? await encryptSecret(password, key) : null;
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO users (id, name, name_th, name_en, full_name_th, full_name_en, email, role,
                            status, created_at, created_by, phone, emergency_name,
                            emergency_relation, emergency_phone, day_rate_satang, started_on,
                            bank_name, bank_account_no, bank_account_name,
                            password_hash, password_salt, password_iterations, password_set_at,
                            password_cipher,
                            pin_hash, pin_salt, pin_iterations, pin_lookup, pin_set_at, pin_cipher)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        name,
        nameTh,
        cleanText(input.nameEn),
        cleanText(input.fullNameTh),
        cleanText(input.fullNameEn),
        email,
        role,
        now,
        actor.userId,
        phone,
        cleanText(input.emergencyName),
        cleanText(input.emergencyRelation),
        cleanText(input.emergencyPhone),
        dayRate,
        startedOn,
        cleanText(input.bankName),
        cleanText(input.bankAccountNo),
        cleanText(input.bankAccountName),
        stored.hash,
        stored.salt,
        stored.iterations,
        password ? now : null,
        passwordCipher,
        pinColumns?.hash ?? null,
        pinColumns?.salt ?? null,
        pinColumns?.iterations ?? null,
        pinColumns?.lookup ?? null,
        pinColumns ? now : null,
        pinColumns?.cipher ?? null,
      )
      .run();
  } catch (err) {
    // Somebody else's save landed between the check above and this one. The unique index is what
    // actually holds the line; this turns its refusal into the same answer the check gives.
    const clash = uniqueClash(err);
    if (clash === "email") return emailTaken();
    if (clash === "pin") {
      return fieldError(409, "pin_taken", "pin", "Someone already uses that PIN. Choose another.");
    }
    throw err;
  }
  return json({ id, name, email, role, status: "active" }, 201);
}

export async function setStaffPassword(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  password: string,
  now: number,
  key?: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const problem = passwordProblem(password);
  if (problem) return json({ error: problem }, 400);

  const target = await db
    .prepare(`SELECT id FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ id: string }>();
  if (!target) return json({ error: "no such person" }, 404);

  const stored = await hashPassword(password);
  // Two copies, two jobs: the hash is what a login is checked against and can never be reversed;
  // the cipher is what the owner reveals later. Without a key we simply store no readable copy —
  // the account still works, the reveal just says the key is missing.
  const cipher = key ? await encryptSecret(password, key) : null;
  await db
    .prepare(
      `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?,
                        password_set_at = ?, password_cipher = ?,
                        failed_attempts = 0, locked_until = NULL, last_failed_at = NULL
        WHERE id = ?`,
    )
    .bind(stored.hash, stored.salt, stored.iterations, now, cipher, userId)
    .run();

  // The lock goes with the old password (owner, 2026-08-03). The 24 hours punish a run of failed
  // guesses against a credential that no longer exists — leaving it in place would mean handing
  // someone a working password and telling them to come back tomorrow.

  // The old password is gone, so the sessions it opened go with it. Otherwise changing a password
  // to lock someone out would leave them logged in on the device that matters.
  await revokeAllStaffSessions(db, userId, now);
  return json({ ok: true });
}

export async function updateStaff(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  input: UpdateStaffInput,
  now: number,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();

  const target = await db
    .prepare(`SELECT id, role, status FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ id: string; role: string; status: string }>();
  if (!target) return json({ error: "no such person" }, 404);

  const nextRole = input.role ?? target.role;
  const nextStatus = input.status ?? target.status;
  if (!isStaffRole(nextRole)) return json({ error: "unknown role" }, 400);
  if (nextStatus !== "active" && nextStatus !== "disabled")
    return json({ error: "unknown status" }, 400);

  // The one door that must never lock behind you: if this change would remove the last active
  // super admin, refuse it. Nobody could then create staff, set passwords, or see a bank slip —
  // and there is no back door, because the roles no longer come from an env var we could edit.
  const losesSuper =
    target.role === "super_admin" && (nextRole !== "super_admin" || nextStatus !== "active");
  if (losesSuper && (await activeSuperAdmins(db, userId)) === 0) {
    return json({ error: "this is the only super admin — promote someone else first" }, 409);
  }

  if (input.dayRateSatang !== undefined) {
    const rate = input.dayRateSatang;
    if (rate !== null && (!Number.isInteger(rate) || rate < 0)) {
      return json({ error: "day rate must be a whole number of satang" }, 400);
    }
    await db.prepare(`UPDATE users SET day_rate_satang = ? WHERE id = ?`).bind(rate, userId).run();
  }

  await db
    .prepare(`UPDATE users SET role = ?, status = ? WHERE id = ?`)
    .bind(nextRole, nextStatus, userId)
    .run();

  // Switching someone off has to take effect now, not whenever their session happens to expire.
  if (nextStatus === "disabled") await revokeAllStaffSessions(db, userId, now);
  return json({ ok: true, role: nextRole, status: nextStatus });
}

/**
 * Who a log line is ABOUT, by name.
 *
 * The activity log is read by a person, so it says "สมชาย" and never a database key (owner,
 * 2026-08-04). Falls back to the id only if the row has vanished, which beats writing nothing —
 * and keeps working for someone deleted since, because a tombstone keeps its `name`.
 */
async function nameOf(db: D1Database, userId: string): Promise<string> {
  try {
    const row = await db
      .prepare(`SELECT COALESCE(name_th, name) AS name FROM users WHERE id = ?`)
      .bind(userId)
      .first<{ name: string | null }>();
    return row?.name || userId;
  } catch {
    return userId;
  }
}

/**
 * Record that the emergency door was used (owner, 2026-08-26).
 *
 * Its own named export rather than opening `logActivity` up: the login route lives outside this
 * module because it runs BEFORE there is a session, and it needs to write exactly this one line —
 * not the freedom to write any line it likes.
 *
 * An emergency sign-in is the single event the owner should always be able to find afterwards,
 * whether or not it was them who did it.
 */
export async function logRecoveryLogin(db: D1Database, userId: string, now: number): Promise<void> {
  await logActivity(db, userId, "recovery_login", null, now);
}

export interface DayOffInput {
  day?: string;
  halves?: number;
  reason?: string;
}

/**
 * Someone's own profile. Includes their password in readable form — the owner decided staff may see
 * and change their own (2026-08-03). Columns are listed one by one; a `SELECT *` here would start
 * shipping the password and PIN hashes to a browser the moment anyone added a column.
 */
export async function ownProfile(
  db: D1Database,
  actor: StaffIdentity,
  key: string,
): Promise<Response> {
  const row = await db
    .prepare(
      `SELECT id, name, name_th AS nameTh, name_en AS nameEn, email, role, phone,
              emergency_phone AS emergencyPhone, emergency_name AS emergencyName,
              started_on AS startedOn, day_rate_satang AS dayRateSatang,
              bank_name AS bankName, bank_account_no AS bankAccountNo,
              bank_account_name AS bankAccountName,
              password_cipher AS cipher, pin_cipher AS pinCipher,
              CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END AS hasPin,
              CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword,
              -- WHETHER one is set and WHEN — never the key itself. There is no readable copy of it
              -- to send even if something here asked for one.
              CASE WHEN recovery_hash IS NULL THEN 0 ELSE 1 END AS hasRecoveryKey,
              recovery_set_at AS recoverySetAt
         FROM users WHERE id = ?`,
    )
    .bind(actor.userId)
    .first<Record<string, unknown> & { cipher: string | null; pinCipher: string | null }>();
  if (!row) return json({ error: "no such person" }, 404);

  const { cipher, pinCipher, ...profile } = row;
  return json({
    profile: {
      ...profile,
      password: key ? await decryptSecret(cipher, key) : null,
      pin: key ? await decryptSecret(pinCipher, key) : null,
    },
  });
}

/**
 * Change your own password. Other devices are signed out; this one is not — being logged out of the
 * screen you just used would look like the change failed.
 */
export async function changeOwnPassword(
  db: D1Database,
  actor: StaffIdentity,
  password: string,
  now: number,
  key: string,
): Promise<Response> {
  const problem = passwordProblem(password);
  if (problem) return json({ error: problem }, 400);

  const stored = await hashPassword(password);
  const cipher = key ? await encryptSecret(password, key) : null;
  await db
    .prepare(
      `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?,
                        password_set_at = ?, password_cipher = ?,
                        failed_attempts = 0, locked_until = NULL, last_failed_at = NULL
        WHERE id = ?`,
    )
    .bind(stored.hash, stored.salt, stored.iterations, now, cipher, actor.userId)
    .run();

  await logActivity(db, actor.userId, "password_changed", null, now);
  return json({ ok: true });
}

/**
 * Choose your own quick-login PIN.
 *
 * Two refusals matter here. An easily guessed PIN is refused because a PIN is typed with no email —
 * it IS the whole lock. And a PIN somebody else already holds is refused because a PIN-only login
 * has to resolve to exactly one person; the UNIQUE index would reject it anyway, and a caught
 * constraint error makes a much worse message than this one.
 */
async function writePin(
  db: D1Database,
  userId: string,
  pin: string,
  now: number,
  pepper: string,
  key: string,
): Promise<Response | null> {
  const prepared = await preparePin(db, userId, pin, pepper, key);
  if (!prepared.ok) {
    // The wording these routes have always answered with — the old admin shows it as it is.
    if (prepared.code === "pin_unavailable") return json({ error: "pin_unavailable" }, 503);
    if (prepared.code === "pin_taken") {
      return json({ error: "Someone already uses that PIN. Choose another." }, 409);
    }
    return json({ error: prepared.message }, 400);
  }
  const p = prepared.columns;
  await db
    .prepare(
      `UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iterations = ?, pin_lookup = ?,
                        pin_set_at = ?, pin_cipher = ?
        WHERE id = ?`,
    )
    .bind(p.hash, p.salt, p.iterations, p.lookup, now, p.cipher, userId)
    .run();
  return null;
}

/** A PIN ready to store, or the reason it can't be — one set of rules for every door that sets one. */
type PreparedPin =
  | {
      ok: true;
      columns: Awaited<ReturnType<typeof hashPassword>> & {
        lookup: string;
        cipher: string | null;
      };
    }
  | {
      ok: false;
      code: "pin_unavailable" | "pin_format" | "pin_too_easy" | "pin_taken";
      message: string;
    };

/**
 * Check a PIN and work out what to store for it — without storing anything.
 *
 * Split out of `writePin` so the add form can put the PIN into the same INSERT as the person: a
 * person saved without the PIN they were given would be a PIN-only account nobody can open.
 * `userId` is who the PIN is for (null for somebody not saved yet), so their own PIN never counts
 * as taken.
 */
async function preparePin(
  db: D1Database,
  userId: string | null,
  pin: string,
  pepper: string,
  key: string,
): Promise<PreparedPin> {
  if (!pepper) {
    return { ok: false, code: "pin_unavailable", message: "PINs are not configured." };
  }
  const problem = pinProblem(pin);
  if (problem) {
    return {
      ok: false,
      code: /^\d{6}$/.test(pin) ? "pin_too_easy" : "pin_format",
      message: problem,
    };
  }

  const lookup = await pinLookup(pin, pepper);
  const taken = await db
    .prepare(`SELECT id FROM users WHERE pin_lookup = ? AND id <> ?`)
    .bind(lookup, userId ?? "")
    .first<{ id: string }>();
  if (taken) {
    return {
      ok: false,
      code: "pin_taken",
      message: "Someone already uses that PIN. Choose another.",
    };
  }

  const stored = await hashPassword(pin);
  // Two copies, same split as the password: the hash authorises, the cipher is what the owner can
  // reveal (0085). Without a key we simply store no readable copy — the PIN still works.
  const cipher = key ? await encryptSecret(pin, key) : null;
  return {
    ok: true,
    columns: {
      hash: stored.hash,
      salt: stored.salt,
      iterations: stored.iterations,
      lookup,
      cipher,
    },
  };
}

/**
 * The owner setting — or clearing — their own emergency key (owner, 2026-08-26).
 *
 * SUPER ADMIN ALONE, checked here as well as at the door. One emergency key exists in the shop and
 * it is the owner's; a key that somehow reached another row still would not open anything, but it
 * should never get written in the first place.
 *
 * Stored the PIN's way — unique peppered lookup plus a slow hash — and, unlike the PIN,
 * WITHOUT a readable copy. `pin_cipher` exists because the owner resets other people's PINs and has
 * to read them back; nobody ever needs to read this one, and a key that cannot be revealed cannot
 * be revealed by anyone else either. Lose it and set another.
 */
export async function setOwnRecoveryKey(
  db: D1Database,
  actor: StaffIdentity,
  key: string,
  now: number,
  pepper: string,
): Promise<Response> {
  if (!canUseRecoveryKey(actor.role)) return json({ error: "forbidden" }, 403);
  if (!pepper) return json({ error: "recovery_unavailable" }, 503);
  const problem = recoveryKeyProblem(key);
  if (problem) return json({ error: problem }, 400);

  const trimmed = key.trim();
  const lookup = await recoveryLookup(trimmed, pepper);
  // UNIQUE in the schema too — this is the friendly answer rather than a constraint error.
  const taken = await db
    .prepare(`SELECT id FROM users WHERE recovery_lookup = ? AND id <> ?`)
    .bind(lookup, actor.userId)
    .first<{ id: string }>();
  if (taken) return json({ error: "Someone already uses that key. Choose another." }, 409);

  const stored = await hashPassword(trimmed);
  await db
    .prepare(
      `UPDATE users SET recovery_hash = ?, recovery_salt = ?, recovery_iterations = ?,
                        recovery_lookup = ?, recovery_set_at = ?
        WHERE id = ?`,
    )
    .bind(stored.hash, stored.salt, stored.iterations, lookup, now, actor.userId)
    .run();
  await logActivity(db, actor.userId, "recovery_key_set", null, now);
  return json({ ok: true });
}

/** Remove it. The emailed Access code remains, so the owner is never left with no way back. */
export async function clearOwnRecoveryKey(
  db: D1Database,
  actor: StaffIdentity,
  now: number,
): Promise<Response> {
  if (!canUseRecoveryKey(actor.role)) return json({ error: "forbidden" }, 403);
  await db
    .prepare(
      `UPDATE users SET recovery_hash = NULL, recovery_salt = NULL, recovery_iterations = NULL,
                        recovery_lookup = NULL, recovery_set_at = NULL
        WHERE id = ?`,
    )
    .bind(actor.userId)
    .run();
  await logActivity(db, actor.userId, "recovery_key_cleared", null, now);
  return json({ ok: true });
}

export async function setOwnPin(
  db: D1Database,
  actor: StaffIdentity,
  pin: string,
  now: number,
  pepper: string,
  key = "",
): Promise<Response> {
  const failed = await writePin(db, actor.userId, pin, now, pepper, key);
  if (failed) return failed;
  await logActivity(db, actor.userId, "pin_changed", null, now);
  return json({ ok: true });
}

/**
 * The owner setting somebody else's PIN — the reset half of the Staff page's PIN row.
 *
 * Like a password reset, it ends their sessions: the credential they were signed in under has been
 * replaced, so leaving those open would mean a "reset" that didn't actually shut anything.
 */
export async function setStaffPin(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  pin: string,
  now: number,
  pepper: string,
  key = "",
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const target = await db
    .prepare(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ id: string }>();
  if (!target) return json({ error: "no such person" }, 404);

  const failed = await writePin(db, userId, pin, now, pepper, key);
  if (failed) return failed;

  await revokeAllStaffSessions(db, userId, now);
  await logActivity(
    db,
    actor.userId,
    "pin_changed",
    `Reset the PIN for ${await nameOf(db, userId)}`,
    now,
  );
  return json({ ok: true });
}

/**
 * Record a day off — self-reported, no approval (owner: "so they can inform by themselves").
 * Re-recording the same date REPLACES it, so correcting a half day to a full one can't quietly
 * charge the month twice.
 */
export async function recordDayOff(
  db: D1Database,
  actor: StaffIdentity,
  input: DayOffInput,
  now: number,
): Promise<Response> {
  return writeDayOff(db, actor, actor.userId, input, now);
}

/**
 * Record a day off ON BEHALF OF a staff member. Super admin only.
 *
 * `user_id` is whose day off it is; `created_by` is who typed it in. Keeping them apart is the whole
 * point — conflating them would put the mechanic's absence on the owner's own month.
 */
export async function recordDayOffFor(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  input: DayOffInput,
  now: number,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const target = await db
    .prepare(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ id: string }>();
  if (!target) return json({ error: "not found" }, 404);
  return writeDayOff(db, actor, userId, input, now);
}

/**
 * The one writer both paths go through, so a day off recorded by the owner and one recorded by the
 * person are validated and stored identically.
 *
 * The upsert is what makes "one row per day" true rather than merely intended: the table is unique
 * on (user_id, day), so re-submitting a date — or editing a row onto a date that already has one —
 * REPLACES it instead of leaving two rows quietly double-counting against a wage.
 */
async function writeDayOff(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  input: DayOffInput,
  now: number,
): Promise<Response> {
  const day = (input.day ?? "").trim();
  const halves = input.halves;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: "Pick a date." }, 400);
  // Validated against core's closed set, not an inline pair of comparisons: `halves` is subtracted
  // straight from the month's wage, so an unexpected value here costs somebody real money.
  if (!isLeaveHalves(halves)) return json({ error: "Choose how much of the day." }, 400);

  await db
    .prepare(
      `INSERT INTO staff_days_off (id, user_id, day, halves, reason, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day) DO UPDATE SET halves = ?, reason = ?, created_at = ?, created_by = ?`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      day,
      halves,
      input.reason ?? null,
      now,
      actor.userId,
      halves,
      input.reason ?? null,
      now,
      actor.userId,
    )
    .run();

  await logActivity(db, actor.userId, "day_off", `${day} · ${leaveModeLabel(halves)}`, now);
  return json({ ok: true }, 201);
}

/**
 * Edit an existing day off IN PLACE — the row moves rather than being re-created.
 *
 * Distinct from the upsert on purpose. Re-submitting keys on (person, day), so changing a row's DATE
 * that way would write a row for the new day and strand the old one — and staff cannot delete, so
 * they would be left with a day off they never took, quietly costing them a day's wage.
 *
 * Staff may edit only their own; a super admin may edit anyone's. A move onto a date the person
 * already has is REFUSED rather than overwritten: overwriting would destroy the other row, which is
 * deletion by another name and exactly the power staff are not meant to have.
 */
export async function updateDayOff(
  db: D1Database,
  actor: StaffIdentity,
  id: string,
  input: DayOffInput,
  now: number,
): Promise<Response> {
  const row = await db
    .prepare(`SELECT id, user_id AS userId, day FROM staff_days_off WHERE id = ?`)
    .bind(id)
    .first<{ id: string; userId: string; day: string }>();
  if (!row) return json({ error: "not found" }, 404);
  if (row.userId !== actor.userId && !canManageStaff(actor.role)) return forbidden();

  const day = (input.day ?? "").trim();
  const halves = input.halves;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: "Pick a date." }, 400);
  if (!isLeaveHalves(halves)) return json({ error: "Choose how much of the day." }, 400);

  if (day !== row.day) {
    const clash = await db
      .prepare(`SELECT id FROM staff_days_off WHERE user_id = ? AND day = ? AND id <> ?`)
      .bind(row.userId, day, id)
      .first<{ id: string }>();
    if (clash) return json({ error: "วันที่นี้มีบันทึกอยู่แล้ว" }, 409);
  }

  await db
    .prepare(
      `UPDATE staff_days_off SET day = ?, halves = ?, reason = ?, created_at = ? WHERE id = ?`,
    )
    .bind(day, halves, input.reason ?? null, now, id)
    .run();

  await logActivity(db, actor.userId, "day_off_edit", `${day} · ${leaveModeLabel(halves)}`, now);
  return json({ ok: true });
}

/** One month of my own days off, newest first. */
export async function listMyDaysOff(
  db: D1Database,
  actor: StaffIdentity,
  month: string,
): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT id, day, halves, reason FROM staff_days_off
        WHERE user_id = ? AND substr(day, 1, 7) = ?
        ORDER BY day DESC`,
    )
    .bind(actor.userId, month)
    .all();
  return json({ days: results ?? [] });
}

/**
 * Everyone's days off for a month. Super admin only — who else is off is not a mechanic's to read,
 * and the reason field is free text that may say why somebody was at a hospital.
 */
export async function listTeamDaysOff(
  db: D1Database,
  actor: StaffIdentity,
  month: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const { results } = await db
    .prepare(
      `SELECT d.id, d.user_id AS userId, d.day, d.halves, d.reason,
              u.name, u.name_th AS nameTh, u.role
         FROM staff_days_off d
         JOIN users u ON u.id = d.user_id
        WHERE substr(d.day, 1, 7) = ? AND u.deleted_at IS NULL
        ORDER BY d.day DESC, u.name`,
    )
    .bind(month)
    .all();
  return json({ days: results ?? [] });
}

/**
 * ONE person's days off for a month — the super admin's view of them, on their profile.
 *
 * The team screen answers "who was off in August"; a profile answers "when was THIS person off",
 * which is the question you have while looking at their wage. Filtering the team list in the page
 * would have worked and been wrong in one specific way: `reason` is free text and someone will
 * write why they were at a hospital in it, so shipping the whole team's reasons to a page that
 * displays one of them hands the browser more than it needs.
 *
 * No `name` columns, unlike the team list — the page already knows whose profile it is.
 * Super admin only, same as the team list: staff read their own at /staff/me/days-off.
 */
export async function listDaysOffFor(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  month: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const { results } = await db
    .prepare(
      `SELECT d.id, d.user_id AS userId, d.day, d.halves, d.reason
         FROM staff_days_off d
         JOIN users u ON u.id = d.user_id
        WHERE d.user_id = ? AND substr(d.day, 1, 7) = ? AND u.deleted_at IS NULL
        ORDER BY d.day DESC`,
    )
    .bind(userId, month)
    .all();
  return json({ days: results ?? [] });
}

/**
 * เงินเบิกล่วงหน้า — salary handed over before payday (owner, 2026-08-24).
 *
 * Money leaving the shop, so recording and removing one is the super admin's alone; staff read
 * their own totals but never write one.
 *
 * THE SLIP RULE IS NOT RE-DERIVED HERE. `payoutProblem` in core owns it — cash needs nothing,
 * a transfer needs its slip — so the advance form and the wage form cannot drift into disagreeing
 * about what counts as proof, and the sentence the screen shows is the same either way.
 */
export interface AdvanceInput {
  period?: string;
  givenOn?: string;
  amountSatang?: number;
  method?: string;
  slipKey?: string | null;
  note?: string | null;
  /** คนจ่าย — who handed it over. An active super admin; defaults to whoever is signed in. */
  paidBy?: string | null;
}

/**
 * คนจ่าย — who handed the money over (0097). Defaults to the signed-in owner; anyone named instead
 * must be an ACTIVE super admin who has not been deleted. Money out is the owners' alone, so a
 * payment "handed over" by a mechanic, a switched-off account or a stranger is not a record.
 */
async function resolvePayer(
  db: D1Database,
  actor: StaffIdentity,
  requested: string | null | undefined,
): Promise<{ ok: true; payerId: string } | { ok: false; response: Response }> {
  const payerId = cleanText(requested) ?? actor.userId;
  const row = await db
    .prepare(
      `SELECT id FROM users
        WHERE id = ? AND role = 'super_admin' AND status = 'active' AND deleted_at IS NULL`,
    )
    .bind(payerId)
    .first<{ id: string }>();
  if (row) return { ok: true, payerId };
  return {
    ok: false,
    response: fieldError(
      400,
      "payer_invalid",
      "paidBy",
      "The payer must be an active owner (super admin).",
    ),
  };
}

export async function recordAdvance(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  input: AdvanceInput,
  now: number,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();

  const period = input.period ?? "";
  const givenOn = input.givenOn ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return json({ error: "period must look like 2026-08" }, 400);
  }
  // A plain Bangkok day, like staff_days_off.day — never parsed into a Date, so it cannot shift.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(givenOn)) {
    return json({ error: "givenOn must look like 2026-08-22" }, 400);
  }
  const amountSatang = input.amountSatang ?? 0;
  if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
    return json({ error: "an advance needs an amount above zero" }, 400);
  }
  const problem = payoutProblem({ method: input.method, slipKey: input.slipKey ?? null });
  if (problem) return json({ error: problem }, 400);
  const payer = await resolvePayer(db, actor, input.paidBy);
  if (!payer.ok) return payer.response;

  const person = await db
    .prepare(
      `SELECT COALESCE(name_th, name) AS name FROM users WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(userId)
    .first<{ name: string }>();
  if (!person) return json({ error: "no such person" }, 404);

  // A PAID month is a record of what was handed over, not a running total. The payslip froze the
  // advance figure at the moment of payment; letting another in afterwards would leave the payslip
  // and the advance list disagreeing, with nothing to say which one lied.
  const paid = await db
    .prepare(`SELECT paid_at FROM staff_payslips WHERE user_id = ? AND period = ?`)
    .bind(userId, period)
    .first<{ paid_at: number | null }>();
  if (paid?.paid_at != null) {
    return json({ error: "that month has already been paid" }, 409);
  }

  await db
    .prepare(
      `INSERT INTO staff_advances
         (id, user_id, period, given_on, amount_satang, method, slip_key, note, created_by,
          created_at, paid_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      period,
      givenOn,
      amountSatang,
      input.method as string,
      input.slipKey ?? null,
      input.note?.trim() || null,
      actor.userId,
      now,
      payer.payerId,
    )
    .run();

  // The person's NAME and the amount — this line is read by a human in the activity log, and
  // "an advance was recorded" without either is a line nobody can act on.
  await logActivity(
    db,
    actor.userId,
    "advance_recorded",
    `${person.name} · ${period} · ${(amountSatang / 100).toLocaleString("en-US")} บาท`,
    now,
  );
  return json({ ok: true });
}

/** One person's advances for a month, newest first, plus the total that comes off their wage. */
export async function listAdvancesFor(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  period: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const { results } = await db
    .prepare(
      `SELECT a.id, a.given_on AS givenOn, a.amount_satang AS amountSatang, a.method,
              a.slip_key AS slipKey, a.note,
              -- คนจ่าย by name; NULL for advances recorded before anyone noted who paid (0097).
              COALESCE(pb.name_th, pb.name) AS paidBy
         FROM staff_advances a
         LEFT JOIN users pb ON pb.id = a.paid_by
        WHERE a.user_id = ? AND a.period = ?
        ORDER BY a.given_on DESC, a.created_at DESC`,
    )
    .bind(userId, period)
    .all<{ amountSatang: number }>();
  const advances = results ?? [];
  return json({
    advances,
    totalSatang: advances.reduce((n, a) => n + a.amountSatang, 0),
  });
}

/**
 * Remove an advance. Super admin only, and for the same reason deleting a day off is: it puts money
 * back into what will be handed over on payday.
 *
 * NOT ONCE THE MONTH IS PAID (owner, 2026-08-25). `recordAdvance` has always refused a paid month;
 * this did not, and the asymmetry was the bug: the payslip FROZE `advance_satang` at the moment of
 * payment, so removing a row afterwards leaves the frozen figure and the surviving rows disagreeing
 * with nothing to say which one is the truth. The wage ledger shows it plainly — it lists the rows
 * but takes its Total from the frozen figure, so the column would simply stop adding up.
 *
 * A paid month is a record of what was handed over, not a running total. Correcting one means
 * correcting the payment.
 */
export async function deleteAdvance(
  db: D1Database,
  actor: StaffIdentity,
  id: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const row = await db
    .prepare(
      `SELECT a.id, a.user_id AS userId, a.period, a.amount_satang AS amountSatang,
              COALESCE(u.name_th, u.name) AS name
         FROM staff_advances a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      userId: string;
      period: string;
      amountSatang: number;
      name: string | null;
    }>();
  if (!row) return json({ error: "no such advance" }, 404);

  // The same check, and the same 409, that recordAdvance makes on the way in — see the note above.
  const paid = await db
    .prepare(`SELECT paid_at FROM staff_payslips WHERE user_id = ? AND period = ?`)
    .bind(row.userId, row.period)
    .first<{ paid_at: number | null }>();
  if (paid?.paid_at != null) {
    return json({ error: "that month has already been paid" }, 409);
  }

  await db.prepare(`DELETE FROM staff_advances WHERE id = ?`).bind(id).run();
  await logActivity(
    db,
    actor.userId,
    "advance_deleted",
    `${row.name ?? "?"} · ${row.period} · ${(row.amountSatang / 100).toLocaleString("en-US")} บาท`,
    Date.now(),
  );
  return json({ ok: true });
}

/**
 * Delete a day off. SUPER ADMIN ONLY (owner, 5 Aug 2026) — staff may edit their own rows but never
 * remove one.
 *
 * The asymmetry is deliberate: editing leaves a record that the day was claimed, while deleting
 * erases that it was ever claimed at all. The second is the one that can quietly restore a day's
 * wage, so it stays with the person who signs the wages.
 */
export async function deleteDayOff(
  db: D1Database,
  actor: StaffIdentity,
  id: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  // Joined for the NAME: the activity log is read by a person, and an internal id in that line
  // tells them nothing about whose day was removed.
  const row = await db
    .prepare(
      `SELECT d.id, d.day, COALESCE(u.name_th, u.name) AS name
         FROM staff_days_off d LEFT JOIN users u ON u.id = d.user_id
        WHERE d.id = ?`,
    )
    .bind(id)
    .first<{ id: string; day: string; name: string | null }>();
  if (!row) return json({ error: "not found" }, 404);
  await db.prepare(`DELETE FROM staff_days_off WHERE id = ?`).bind(id).run();
  await logActivity(
    db,
    actor.userId,
    "day_off_delete",
    `${row.day} · ${row.name ?? ""}`.trim(),
    Date.now(),
  );
  return json({ ok: true });
}

/** Reveal a staff password. Super admin only, and only when the encryption key is configured. */
export async function revealPassword(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  key: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  // Distinguish "the key is missing" from "there is no password". Reporting the first as the second
  // would send the owner off resetting a password that was never the problem.
  if (!key) return json({ error: "reveal_unavailable", reason: "STAFF_SECRET_KEY not set" }, 503);

  const row = await db
    .prepare(`SELECT password_cipher AS cipher FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ cipher: string | null }>();
  if (!row) return json({ error: "no such person" }, 404);
  return json({ password: await decryptSecret(row.cipher, key) });
}

/**
 * Delete someone — a TOMBSTONE, not a DELETE FROM.
 *
 * The owner chose (2026-08-03) that past bills and stock movements keep showing who made them. Those
 * rows carry a foreign key to this one, so the row has to survive; what goes is everything that
 * identifies the person or lets them back in: contact details, bank account, PIN, both copies of the
 * password. The name stays, and every staff list filters `deleted_at`.
 *
 * `pin_lookup` is cleared for a practical reason as well as a privacy one: it is UNIQUE, so leaving
 * it behind would reserve those six digits forever against somebody who no longer works here.
 */
export async function deleteStaff(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  now: number,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  // Deleting the account you are signed in with destroys your own session mid-request. If someone
  // really is leaving, another super admin removes them.
  if (userId === actor.userId) {
    return json({ error: "you can't delete your own account" }, 409);
  }

  const target = await db
    .prepare(`SELECT id, role, status FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ id: string; role: string; status: string }>();
  if (!target) return json({ error: "no such person" }, 404);

  // Same door that must never lock behind you as in updateStaff — deleting the last super admin
  // would leave nobody able to create staff, set passwords or see a slip.
  if (target.role === "super_admin" && (await activeSuperAdmins(db, userId)) === 0) {
    return json({ error: "this is the only super admin — promote someone else first" }, 409);
  }

  await db
    .prepare(
      `UPDATE users
          SET deleted_at = ?, status = 'disabled',
              phone = NULL, emergency_phone = NULL, emergency_name = NULL,
              bank_name = NULL, bank_account_no = NULL, bank_account_name = NULL,
              pin_hash = NULL, pin_salt = NULL, pin_iterations = NULL, pin_lookup = NULL,
              password_hash = NULL, password_salt = NULL, password_iterations = NULL,
              password_cipher = NULL
        WHERE id = ?`,
    )
    .bind(now, userId)
    .run();

  await revokeAllStaffSessions(db, userId, now);
  return json({ ok: true });
}

/**
 * One month's salary run: day rate × working days, where working days are the month's days minus
 * what each person recorded on their own profile. Nothing is added and nothing deducted — the
 * owner's model, and the arithmetic itself lives in `payForMonth` so it can be tested exactly.
 *
 * Anyone without a day rate is left out rather than shown as ฿0: there is genuinely nothing to pay
 * them BY yet, and a zero in a wage table reads like a decision rather than a missing field.
 *
 * Paid months come from `staff_payslips`, which stores a SNAPSHOT — a raise next month must never
 * rewrite what this one paid.
 */
export async function salaryMonth(
  db: D1Database,
  actor: StaffIdentity,
  period: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return json({ error: "period must look like 2026-07" }, 400);
  }

  const { results } = await db
    .prepare(
      `SELECT u.id AS userId, u.name AS name, u.name_th AS nameTh, u.role AS role,
              u.day_rate_satang AS dayRateSatang,
              u.bank_name AS bankName, u.bank_account_no AS bankAccountNo,
              u.bank_account_name AS bankAccountName,
              COALESCE((SELECT SUM(d.halves) FROM staff_days_off d
                         WHERE d.user_id = u.id AND substr(d.day, 1, 7) = ?), 0) AS offHalves,
              COALESCE((SELECT SUM(a.amount_satang) FROM staff_advances a
                         WHERE a.user_id = u.id AND a.period = ?), 0) AS advanceSatang,
              p.slip_key AS slipKey,
              p.paid_at AS paidAt,
              p.day_rate_satang AS paidRate,
              p.off_halves AS paidOff,
              p.working_halves AS paidWorking,
              p.amount_satang AS paidAmount,
              p.advance_satang AS paidAdvance,
              COALESCE(pb.name_th, pb.name) AS paidBy
         FROM users u
         LEFT JOIN staff_payslips p ON p.user_id = u.id AND p.period = ?
         LEFT JOIN users pb ON pb.id = p.paid_by
        WHERE u.deleted_at IS NULL
          AND u.day_rate_satang IS NOT NULL
        ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name`,
    )
    .bind(period, period, period)
    .all<{
      userId: string;
      name: string;
      nameTh: string | null;
      role: string;
      dayRateSatang: number;
      bankName: string | null;
      bankAccountNo: string | null;
      bankAccountName: string | null;
      offHalves: number;
      advanceSatang: number;
      slipKey: string | null;
      paidAt: number | null;
      paidRate: number | null;
      paidOff: number | null;
      paidWorking: number | null;
      paidAmount: number | null;
      paidAdvance: number | null;
      paidBy: string | null;
    }>();

  const rows = (results ?? []).map((r) => {
    // Where to send the money travels with the row, so paying someone never needs a second screen
    // (owner, 2026-08-04). `hasSlip` is false both before a slip is uploaded and after the image
    // has been swept, three months on — the payslip itself survives either way.
    const payee = {
      userId: r.userId,
      name: r.nameTh || r.name,
      role: r.role,
      bankName: r.bankName,
      bankAccountNo: r.bankAccountNo,
      bankAccountName: r.bankAccountName,
      hasSlip: r.slipKey !== null,
    };
    // A paid month reports what was PAID, not what today's rate would produce. Recomputing here is
    // how a September raise would silently rewrite August's wage bill.
    // Advances come off the wage the same way the person page shows it: a paid month uses the
    // figure its payslip froze, an unpaid one the advances recorded so far.
    if (r.paidAt !== null && r.paidAmount !== null) {
      const advanceSatang = r.paidAdvance ?? 0;
      return {
        ...payee,
        dayRateSatang: r.paidRate ?? r.dayRateSatang,
        offHalves: r.paidOff ?? 0,
        workingHalves: r.paidWorking ?? 0,
        amountSatang: r.paidAmount,
        advanceSatang,
        ...settleMonth({ earnedSatang: r.paidAmount, advanceSatang }),
        paidAt: r.paidAt,
        paidBy: r.paidBy,
      };
    }
    const pay = payForMonth({
      dayRateSatang: r.dayRateSatang,
      period,
      offHalves: r.offHalves,
    });
    return {
      ...payee,
      dayRateSatang: r.dayRateSatang,
      offHalves: r.offHalves,
      workingHalves: pay.workingHalves,
      amountSatang: pay.amountSatang,
      advanceSatang: r.advanceSatang,
      ...settleMonth({ earnedSatang: pay.amountSatang, advanceSatang: r.advanceSatang }),
      paidAt: r.paidAt,
      paidBy: null,
    };
  });

  return json({
    period,
    daysInMonth: daysInMonth(period),
    rows,
    totalSatang: rows.reduce((n, r) => n + r.amountSatang, 0),
  });
}

/**
 * Mark one person's month as paid — and FREEZE it.
 *
 * The payslip stores the day rate, the days off, the amount AND the advances as they stand right
 * now, rather than a pointer to anything live. A raise in September must never quietly rewrite what
 * August actually paid; a paid month is a record of a payment, not a live calculation. `recordAdvance`
 * refuses a paid month for the other half of the same reason.
 *
 * THE SLIP RULE CHANGED, 2026-08-24. It used to be required unconditionally, which is wrong for a
 * shop that mostly hands over cash: it pushed people into not recording the payment at all, or
 * attaching something meaningless to get past the form, and a rule people route around is not a
 * control. Now it follows `payoutProblem` in core — cash needs nothing, a transfer needs its slip —
 * exactly as an advance does, so the two forms cannot drift apart on what counts as proof.
 */
export async function markSalaryPaid(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  period: string,
  now: number,
  payout: {
    method: unknown;
    slipKey: string | null;
    /** The day the money actually changed hands — not necessarily today. "YYYY-MM-DD". */
    paidOn?: string;
    /** คนจ่าย — an active super admin; defaults to whoever is signed in. */
    paidBy?: string | null;
  },
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return json({ error: "period must look like 2026-07" }, 400);
  }
  const problem = payoutProblem({ method: payout.method, slipKey: payout.slipKey });
  if (problem) return json({ error: problem }, 400);
  if (payout.paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(payout.paidOn)) {
    return json({ error: "paidOn must look like 2026-09-05" }, 400);
  }
  const payer = await resolvePayer(db, actor, payout.paidBy);
  if (!payer.ok) return payer.response;

  const person = await db
    .prepare(
      `SELECT day_rate_satang AS dayRateSatang,
              COALESCE(name_th, name) AS name,
              COALESCE((SELECT SUM(d.halves) FROM staff_days_off d
                         WHERE d.user_id = users.id AND substr(d.day, 1, 7) = ?), 0) AS offHalves,
              COALESCE((SELECT SUM(a.amount_satang) FROM staff_advances a
                         WHERE a.user_id = users.id AND a.period = ?), 0) AS advanceSatang
         FROM users WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(period, period, userId)
    .first<{
      dayRateSatang: number | null;
      name: string;
      offHalves: number;
      advanceSatang: number;
    }>();
  if (!person) return json({ error: "no such person" }, 404);
  if (person.dayRateSatang == null) {
    return json({ error: "set a day rate for this person first" }, 400);
  }

  const pay = payForMonth({
    dayRateSatang: person.dayRateSatang,
    period,
    offHalves: person.offHalves,
  });
  const settled = settleMonth({
    earnedSatang: pay.amountSatang,
    advanceSatang: person.advanceSatang,
  });

  await db
    .prepare(
      `INSERT INTO staff_payslips (id, user_id, period, day_rate_satang, days_in_month,
                                   off_halves, working_halves, amount_satang, advance_satang,
                                   method, paid_at, created_at, slip_key, slip_uploaded_at, paid_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, period) DO UPDATE SET
         day_rate_satang = excluded.day_rate_satang,
         days_in_month = excluded.days_in_month,
         off_halves = excluded.off_halves,
         working_halves = excluded.working_halves,
         amount_satang = excluded.amount_satang,
         advance_satang = excluded.advance_satang,
         method = excluded.method,
         paid_at = excluded.paid_at,
         slip_key = excluded.slip_key,
         slip_uploaded_at = excluded.slip_uploaded_at,
         paid_by = excluded.paid_by`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      period,
      person.dayRateSatang,
      pay.daysInMonth,
      person.offHalves,
      pay.workingHalves,
      pay.amountSatang,
      person.advanceSatang,
      payout.method as string,
      now,
      now,
      payout.slipKey ?? null,
      payout.slipKey ? now : null,
      payer.payerId,
    )
    .run();

  // The person's NAME and what actually changed hands — this line is read by a human in the
  // activity log, and the gross would be the wrong number to remember a cash handover by.
  await logActivity(
    db,
    actor.userId,
    "salary_paid",
    `${person.name} · ${period} · ${(settled.dueSatang / 100).toLocaleString("en-US")} บาท`,
    now,
  );
  return json({
    ok: true,
    earnedSatang: pay.amountSatang,
    advanceSatang: person.advanceSatang,
    dueSatang: settled.dueSatang,
    owedSatang: settled.owedSatang,
    paidAt: now,
  });
}

/**
 * One person's wage, month by month — salary, advances, and what is actually still due.
 *
 * This lives on the person rather than on the salary run (owner, 2026-08-04): the salary table
 * answers "who do I still owe this month", and a wage history answers "what has this person been
 * paid", which is a question about them.
 *
 * IT NO LONGER LISTS PAID MONTHS ONLY (owner, 2026-08-24). That was fine while a month's figure
 * could not change before payday; an advance changes it the moment it is handed over, so the month
 * you are standing in has to be here too — otherwise the one number you want, "what do I owe on
 * the 5th", is the one number the table will not show.
 *
 * A PAID month reports what the payslip FROZE. An unpaid one is computed live. Never the reverse:
 * recomputing a paid month is how a September raise, or a September advance, would quietly rewrite
 * what August actually handed over.
 *
 * `hasSlip` is false both before a slip exists and after the image has been swept at three months —
 * and now also for a cash payment, which never had one. The payment itself is never removed.
 */
/** One advance, as the wage ledger shows it. Never carries the slip key — see below. */
interface AdvanceLine {
  id: string;
  givenOn: string;
  amountSatang: number;
  method: string;
  hasSlip: boolean;
  note: string | null;
  /** คนจ่าย by name, or null for an advance recorded before anyone noted who paid. */
  paidBy: string | null;
}

/** Every "YYYY-MM" from `from` to `to`, both included; none when `from` comes later. */
function monthsBetween(from: string, to: string): string[] {
  const index = (period: string) => {
    const [year, month] = period.split("-").map(Number);
    return year! * 12 + month! - 1;
  };
  const first = index(from);
  return Array.from({ length: Math.max(0, index(to) - first + 1) }, (_, i) => {
    const n = first + i;
    return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
  });
}

export async function staffPayments(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  /** The month "now" falls in, so the running month appears even with nothing recorded against it. */
  currentPeriod: string,
): Promise<Response> {
  if (!canManageStaff(actor.role) && actor.userId !== userId) return forbidden();

  const person = await db
    .prepare(
      `SELECT day_rate_satang AS dayRateSatang, started_on AS startedOn FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<{ dayRateSatang: number | null; startedOn: number | null }>();

  const slips = await db
    .prepare(
      `SELECT p.period, p.amount_satang AS amountSatang, p.day_rate_satang AS dayRateSatang,
              p.working_halves AS workingHalves, p.off_halves AS offHalves,
              p.advance_satang AS advanceSatang, p.method,
              p.paid_at AS paidAt, p.slip_key AS slipKey,
              COALESCE(pb.name_th, pb.name) AS paidBy
         FROM staff_payslips p
         LEFT JOIN users pb ON pb.id = p.paid_by
        WHERE p.user_id = ? AND p.paid_at IS NOT NULL`,
    )
    .bind(userId)
    .all<{
      period: string;
      amountSatang: number;
      dayRateSatang: number;
      workingHalves: number;
      offHalves: number;
      advanceSatang: number;
      method: string | null;
      paidAt: number;
      slipKey: string | null;
      paidBy: string | null;
    }>();

  // ONE ROW PER ADVANCE, not a monthly sum (owner, 2026-08-25). The wage table reads as a ledger —
  // the month's salary, then every advance that came out of it — and a sum cannot say which day the
  // money went, whether it was cash, or whether there is a slip to show for it.
  const advances = await db
    .prepare(
      `SELECT a.id, a.period, a.given_on AS givenOn, a.amount_satang AS amountSatang,
              a.method, a.slip_key AS slipKey, a.note,
              COALESCE(pb.name_th, pb.name) AS paidBy
         FROM staff_advances a
         LEFT JOIN users pb ON pb.id = a.paid_by
        WHERE a.user_id = ?
        ORDER BY a.given_on DESC, a.created_at DESC`,
    )
    .bind(userId)
    .all<{
      id: string;
      period: string;
      givenOn: string;
      amountSatang: number;
      method: string;
      slipKey: string | null;
      note: string | null;
      paidBy: string | null;
    }>();

  const daysOff = await db
    .prepare(
      `SELECT substr(day, 1, 7) AS period, SUM(halves) AS offHalves FROM staff_days_off
        WHERE user_id = ? GROUP BY substr(day, 1, 7)`,
    )
    .bind(userId)
    .all<{ period: string; offHalves: number }>();

  const paidBy = new Map((slips.results ?? []).map((r) => [r.period, r]));
  // The slip KEY stays here — it names an R2 object, and the row only needs to know whether there
  // is one to offer. The image itself comes from its own gated route.
  const advanceRowsBy = new Map<string, AdvanceLine[]>();
  for (const a of advances.results ?? []) {
    const list = advanceRowsBy.get(a.period) ?? [];
    list.push({
      id: a.id,
      givenOn: a.givenOn,
      amountSatang: a.amountSatang,
      method: a.method,
      hasSlip: a.slipKey !== null,
      note: a.note,
      paidBy: a.paidBy,
    });
    advanceRowsBy.set(a.period, list);
  }
  const advanceBy = new Map(
    [...advanceRowsBy].map(([period, list]) => [
      period,
      list.reduce((n, a) => n + a.amountSatang, 0),
    ]),
  );
  const offBy = new Map((daysOff.results ?? []).map((r) => [r.period, r.offHalves]));

  // The month the shop first recorded any pay in the app — anyone's salary or advance. Months before
  // it were paid by hand, so listing them would show every one of them as owed.
  const firstPay = await db
    .prepare(
      `SELECT MIN(period) AS period FROM (
         SELECT period FROM staff_payslips WHERE paid_at IS NOT NULL
         UNION ALL SELECT period FROM staff_advances)`,
    )
    .first<{ period: string | null }>();

  // Every month worth a row: every month since the person started work, but not before the shop's
  // first pay in the app — a month nobody paid is still owed, so it must not drop off the list
  // (owner, 2 Nov 2026) — plus one that was paid or has an advance against it, and the month we are
  // standing in. With no start date, or no pay recorded yet, only those last ones.
  const startMonth =
    person?.startedOn == null ? null : new Date(person.startedOn).toISOString().slice(0, 7);
  const sinceStart =
    startMonth === null || !firstPay?.period
      ? []
      : monthsBetween(startMonth > firstPay.period ? startMonth : firstPay.period, currentPeriod);
  const periods = new Set<string>([
    ...sinceStart,
    ...paidBy.keys(),
    ...advanceBy.keys(),
    currentPeriod,
  ]);

  const payments = [...periods]
    .sort((a, b) => b.localeCompare(a))
    .map((period) => {
      const slip = paidBy.get(period);
      if (slip) {
        const settled = settleMonth({
          earnedSatang: slip.amountSatang,
          advanceSatang: slip.advanceSatang,
        });
        return {
          period,
          dayRateSatang: slip.dayRateSatang,
          offHalves: slip.offHalves,
          workingHalves: slip.workingHalves,
          earnedSatang: slip.amountSatang,
          advanceSatang: slip.advanceSatang,
          ...settled,
          paidAt: slip.paidAt,
          method: slip.method,
          hasSlip: slip.slipKey !== null,
          paidBy: slip.paidBy,
          advances: advanceRowsBy.get(period) ?? [],
        };
      }
      const rate = person?.dayRateSatang ?? 0;
      const pay = payForMonth({
        dayRateSatang: rate,
        period,
        offHalves: offBy.get(period) ?? 0,
      });
      const advanceSatang = advanceBy.get(period) ?? 0;
      return {
        period,
        dayRateSatang: rate,
        offHalves: offBy.get(period) ?? 0,
        workingHalves: pay.workingHalves,
        earnedSatang: pay.amountSatang,
        advanceSatang,
        ...settleMonth({ earnedSatang: pay.amountSatang, advanceSatang }),
        paidAt: null,
        method: null,
        hasSlip: false,
        paidBy: null,
        advances: advanceRowsBy.get(period) ?? [],
      };
    });

  return json({ payments });
}

/**
 * The stored slip for one person's month, or null if there isn't one to show.
 *
 * Readable by the owner and by the person the money went to — a wage slip is that person's own
 * proof of pay (owner, 2026-08-04) — and by nobody else, because it carries both parties' bank
 * details. Returns null rather than throwing for "no slip", "swept" and "not yours" alike: the
 * caller turns all three into the same 404, so the route can't be used to probe who was paid when.
 */
export async function salarySlipKey(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  period: string,
): Promise<string | null> {
  if (!canManageStaff(actor.role) && actor.userId !== userId) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const row = await db
    .prepare(`SELECT slip_key AS slipKey FROM staff_payslips WHERE user_id = ? AND period = ?`)
    .bind(userId, period)
    .first<{ slipKey: string | null }>();
  return row?.slipKey ?? null;
}

/**
 * The stored slip for ONE advance, or null if there isn't one you may see.
 *
 * Uploading an advance's slip has worked since migration 0089; looking at it never did, because no
 * route ever served it. The wage ledger asks for it by row (owner, 2026-08-25), so here it is.
 *
 * Same shape as `salarySlipKey`, deliberately: the owner, or the person the money went to — an
 * advance is that person's own proof of payment too. "No such advance", "not yours" and "cash, so
 * there is no slip" all return the same null, which the route turns into the same 404, so this
 * cannot be used to probe who was advanced what.
 */
export async function advanceSlipKey(
  db: D1Database,
  actor: StaffIdentity,
  id: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT user_id AS userId, slip_key AS slipKey FROM staff_advances WHERE id = ?`)
    .bind(id)
    .first<{ userId: string; slipKey: string | null }>();
  if (!row) return null;
  if (!canManageStaff(actor.role) && actor.userId !== row.userId) return null;
  return row.slipKey ?? null;
}

/** Same ceiling as every other image upload (MAX_IMAGE_BYTES in index.ts): 5 MB. */
const STAFF_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Why a photo upload can't be stored, as a `fieldError` on the "photo" box — or null if it can.
 *
 * Any image a phone produces (JPEG, PNG, HEIC…) — but never SVG: it is a document that can carry
 * script, and these photos are served back with exactly the type they arrived with. Shared by a
 * person's photo and the optional photo of a cash wage payment.
 */
export function photoUploadProblem(contentType: string, byteLength: number): Response | null {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (!type.startsWith("image/") || type.startsWith("image/svg")) {
    return fieldError(400, "photo_type", "photo", "The photo must be an image (JPEG or PNG).");
  }
  if (!byteLength) return fieldError(400, "photo_required", "photo", "Choose a photo.");
  if (byteLength > STAFF_PHOTO_MAX_BYTES) {
    return fieldError(400, "photo_too_large", "photo", "The photo is too large (max 5 MB).");
  }
  return null;
}

/**
 * A person's photo — the face on their row and their page (owner, 2026-11).
 *
 * The image lives in R2 under staff-photo/<id>/; users.photo_key names it. Super admin only, like
 * every other change to a person. The body is read only once that is settled, so nobody else can
 * make the Worker swallow an upload it is going to refuse anyway.
 *
 * Order: the new image first, then the row, then the old image. A failure part-way leaves either
 * the old photo still showing or an unreferenced old image in the bucket — never a row that points
 * at nothing.
 */
export async function putStaffPhoto(
  db: D1Database,
  bucket: R2Bucket,
  actor: StaffIdentity,
  userId: string,
  upload: { contentType: string; read: () => Promise<ArrayBuffer> },
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const target = await db
    .prepare(`SELECT photo_key AS photoKey FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ photoKey: string | null }>();
  if (!target) return json({ error: "no such person" }, 404);

  const contentType = upload.contentType.split(";")[0]!.trim().toLowerCase();
  // The type is checked before the body is read, so a refused upload is never swallowed whole.
  const wrongType = photoUploadProblem(contentType, 1);
  if (wrongType) return wrongType;
  const bytes = await upload.read();
  const problem = photoUploadProblem(contentType, bytes.byteLength);
  if (problem) return problem;

  const key = `staff-photo/${userId}/${crypto.randomUUID()}.jpg`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  await db.prepare(`UPDATE users SET photo_key = ? WHERE id = ?`).bind(key, userId).run();
  if (target.photoKey) await deleteImageQuietly(bucket, target.photoKey);
  return json({ ok: true });
}

/** Take a person's photo away: the row stops naming it, then the image goes. */
export async function clearStaffPhoto(
  db: D1Database,
  bucket: R2Bucket,
  actor: StaffIdentity,
  userId: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const target = await db
    .prepare(`SELECT photo_key AS photoKey FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ photoKey: string | null }>();
  if (!target) return json({ error: "no such person" }, 404);
  await db.prepare(`UPDATE users SET photo_key = NULL WHERE id = ?`).bind(userId).run();
  if (target.photoKey) await deleteImageQuietly(bucket, target.photoKey);
  return json({ ok: true });
}

/**
 * The stored photo for one person, or null if there isn't one you may see.
 *
 * Same rule as `salarySlipKey`: the owner, or the person themself. "No photo", "no such person"
 * and "not yours" are all null, which the route turns into the same 404.
 */
export async function staffPhotoKey(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
): Promise<string | null> {
  if (!canManageStaff(actor.role) && actor.userId !== userId) return null;
  const row = await db
    .prepare(`SELECT photo_key AS photoKey FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ photoKey: string | null }>();
  return row?.photoKey ?? null;
}

/**
 * Delete an image nothing points at any more. A failure is logged, not thrown: the row is already
 * right, and failing the request now would tell the owner their new photo didn't save when it did.
 */
async function deleteImageQuietly(bucket: R2Bucket, key: string): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (err) {
    console.error("staff photo: old image left in R2:", key, err);
  }
}

/**
 * The nightly sweep: delete wage-slip images that have served their three months.
 *
 * The image goes; the payslip row — what was paid, to whom, when — stays forever. `slip_key` is
 * nulled in the same pass, so a failed R2 delete simply retries tomorrow rather than orphaning a
 * row that claims to hold an image it no longer has.
 *
 * Returns how many were swept, for the cron log.
 */
export async function purgeExpiredSalarySlips(
  db: D1Database,
  bucket: R2Bucket,
  now: number,
): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT id, slip_key AS slipKey, paid_at AS paidAt
         FROM staff_payslips
        WHERE slip_key IS NOT NULL AND paid_at IS NOT NULL`,
    )
    .all<{ id: string; slipKey: string; paidAt: number }>();

  const due = (results ?? []).filter((r) => slipIsExpired(r.paidAt, now));
  for (const row of due) {
    await bucket.delete(row.slipKey);
    await db.prepare(`UPDATE staff_payslips SET slip_key = NULL WHERE id = ?`).bind(row.id).run();
  }
  return due.length;
}

/** The owner's record of what staff changed. Newest first, optionally one person or one month. */
export async function staffActivity(
  db: D1Database,
  actor: StaffIdentity,
  filter: { userId?: string; period?: string },
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();

  const where: string[] = [];
  const binds: unknown[] = [];
  if (filter.userId) {
    where.push("a.user_id = ?");
    binds.push(filter.userId);
  }
  if (filter.period) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(filter.period)) {
      return json({ error: "period must look like 2026-07" }, 400);
    }
    // Month boundaries in milliseconds — cheaper and index-friendlier than formatting every row.
    const [y, m] = filter.period.split("-").map(Number);
    where.push("a.created_at >= ? AND a.created_at < ?");
    binds.push(Date.UTC(y!, m! - 1, 1), Date.UTC(y!, m!, 1));
  }

  const { results } = await db
    .prepare(
      `SELECT a.id, a.kind, a.detail, a.created_at AS createdAt,
              u.id AS userId, COALESCE(u.name_th, u.name) AS name, u.role AS role
         FROM staff_activity a
         JOIN users u ON u.id = a.user_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY a.created_at DESC
        LIMIT 200`,
    )
    .bind(...binds)
    .all();
  return json({ activity: results ?? [] });
}

/** Everything the owner may change about a person. Anything omitted is left exactly as it was. */
export interface StaffProfileInput {
  nameTh?: string | null;
  nameEn?: string | null;
  /** ชื่อจริง — the real full name, Thai and English. */
  fullNameTh?: string | null;
  fullNameEn?: string | null;
  /** Blank or null clears it (0097) — allowed only while they have a PIN to sign in with. */
  email?: string | null;
  phone?: string | null;
  emergencyName?: string | null;
  /** เกี่ยวข้องเป็น — e.g. แม่. */
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  startedOn?: number | null;
  dayRateSatang?: number | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
}

/** The columns a profile view may show. Listed by hand — a SELECT * here would ship hashes. */
const PROFILE_COLUMNS = `id, name, name_th AS nameTh, name_en AS nameEn,
       full_name_th AS fullNameTh, full_name_en AS fullNameEn, email, role, status,
       phone, emergency_phone AS emergencyPhone, emergency_name AS emergencyName,
       emergency_relation AS emergencyRelation,
       started_on AS startedOn, day_rate_satang AS dayRateSatang,
       bank_name AS bankName, bank_account_no AS bankAccountNo,
       bank_account_name AS bankAccountName,
       last_login_at AS lastLoginAt, locked_until AS lockedUntil,
       password_cipher AS cipher, pin_cipher AS pinCipher,
       CASE WHEN photo_key IS NULL THEN 0 ELSE 1 END AS hasPhoto,
       CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END AS hasPin,
       CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword`;

/** One person, as the owner sees them — including their password in readable form. */
export async function staffProfileFor(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  key: string,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const row = await db
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<Record<string, unknown> & { cipher: string | null; pinCipher: string | null }>();
  if (!row) return json({ error: "no such person" }, 404);

  const { cipher, pinCipher, ...profile } = row;
  return json({
    profile: {
      ...profile,
      password: key ? await decryptSecret(cipher, key) : null,
      pin: key ? await decryptSecret(pinCipher, key) : null,
    },
  });
}

/**
 * Edit a person. Only the fields actually sent are touched, so a form that posts one box cannot
 * blank out the rest.
 *
 * The Thai name doubles as the display name (`name`) wherever one line is all there is room for —
 * the staff list, the salary run, the activity log. Keeping them in step here means those never
 * disagree with the profile.
 */
export async function updateStaffProfile(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  input: StaffProfileInput,
  now: number,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();

  const target = await db
    .prepare(`SELECT id, pin_hash AS pinHash FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ id: string; pinHash: string | null }>();
  if (!target) return json({ error: "no such person" }, 404);

  if (input.dayRateSatang !== undefined && input.dayRateSatang !== null) {
    if (!Number.isInteger(input.dayRateSatang) || input.dayRateSatang < 0) {
      return fieldError(
        400,
        "day_rate_invalid",
        "dayRateSatang",
        "day rate must be a whole number of satang",
      );
    }
  }

  // undefined = not sent, leave it; blank or null = clear it; anything else = the new address.
  const email =
    input.email === undefined ? undefined : (cleanText(input.email)?.toLowerCase() ?? null);
  if (email) {
    // An email IS the username, so a duplicate would make two accounts answer to one sign-in.
    const clash = await db
      .prepare(`SELECT id FROM users WHERE lower(email) = ? AND id <> ?`)
      .bind(email, userId)
      .first<{ id: string }>();
    if (clash) return emailTaken();
  }
  // Clearing the email leaves the PIN as their only way in — the add form's rule, kept here too,
  // so an edit cannot quietly produce an account nobody can open.
  if (email === null && target.pinHash === null) {
    return fieldError(
      400,
      "pin_required_without_email",
      "pin",
      "Without an email they sign in by PIN — set one first.",
    );
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  const put = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };
  const trimmed = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null;

  if (input.nameTh !== undefined) put("name_th", trimmed(input.nameTh));
  if (input.nameEn !== undefined) put("name_en", trimmed(input.nameEn));
  if (input.fullNameTh !== undefined) put("full_name_th", trimmed(input.fullNameTh));
  if (input.fullNameEn !== undefined) put("full_name_en", trimmed(input.fullNameEn));
  if (email !== undefined) put("email", email);
  if (input.phone !== undefined) put("phone", trimmed(input.phone));
  if (input.emergencyName !== undefined) put("emergency_name", trimmed(input.emergencyName));
  if (input.emergencyRelation !== undefined) {
    put("emergency_relation", trimmed(input.emergencyRelation));
  }
  if (input.emergencyPhone !== undefined) put("emergency_phone", trimmed(input.emergencyPhone));
  if (input.startedOn !== undefined) put("started_on", input.startedOn);
  if (input.dayRateSatang !== undefined) put("day_rate_satang", input.dayRateSatang);
  if (input.bankName !== undefined) put("bank_name", trimmed(input.bankName));
  if (input.bankAccountNo !== undefined) put("bank_account_no", trimmed(input.bankAccountNo));
  if (input.bankAccountName !== undefined) put("bank_account_name", trimmed(input.bankAccountName));

  // The one-line display name follows the Thai name, then the English one.
  const displayName = trimmed(input.nameTh) ?? trimmed(input.nameEn);
  if (displayName) put("name", displayName);

  if (sets.length === 0) return json({ ok: true, changed: 0 });

  binds.push(userId);
  try {
    await db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
  } catch (err) {
    // The email was claimed between the check above and this write; the unique index refused it.
    if (uniqueClash(err) === "email") return emailTaken();
    throw err;
  }

  await logActivity(
    db,
    actor.userId,
    "profile_edited",
    `Edited ${await nameOf(db, userId)}’s profile`,
    now,
  );
  return json({ ok: true, changed: sets.length });
}

/**
 * Forget someone's PIN so they can choose a new one.
 *
 * `pin_lookup` goes too, not just the hash: it is UNIQUE, so leaving it behind would reserve those
 * six digits against a PIN nobody can use any more. The owner never picks the replacement — the
 * person sets it themselves from their own profile, which is what keeps a PIN personal.
 */
export async function clearStaffPin(
  db: D1Database,
  actor: StaffIdentity,
  userId: string,
  now: number,
): Promise<Response> {
  if (!canManageStaff(actor.role)) return forbidden();
  const target = await db
    .prepare(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`)
    .bind(userId)
    .first<{ id: string }>();
  if (!target) return json({ error: "no such person" }, 404);

  await db
    .prepare(
      `UPDATE users SET pin_hash = NULL, pin_salt = NULL, pin_iterations = NULL,
                        pin_lookup = NULL, pin_set_at = NULL, pin_cipher = NULL
        WHERE id = ?`,
    )
    .bind(userId)
    .run();

  await logActivity(
    db,
    actor.userId,
    "pin_cleared",
    `Cleared the PIN for ${await nameOf(db, userId)}`,
    now,
  );
  return json({ ok: true });
}
