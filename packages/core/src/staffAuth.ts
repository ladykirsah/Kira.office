/**
 * Staff logins for the back office — passwords, sessions and the permission matrix.
 *
 * This replaces two older systems, both of which are being deleted:
 *   · Cloudflare Access as the identity source (an email from a JWT the edge injected), and
 *   · roles read from env email lists (SUPER_ADMIN_EMAILS / MECHANIC_EMAILS) in `access.ts`.
 *
 * SECURITY POSTURE, decided before building:
 *  - Passwords are PBKDF2-HMAC-SHA256 with a per-account random salt. Workers has no bcrypt or
 *    argon2, and PBKDF2 is what WebCrypto gives us; the iteration count is stored ON THE ROW so it
 *    can be raised later without locking anyone out of an account hashed under the old number.
 *  - A row with no password NEVER verifies. An account is created without one, and until the super
 *    admin sets it that account cannot be logged into — "no password" must not read as "any
 *    password" (the exact shape of the fail-open bug this whole change exists to remove).
 *  - Comparison is constant-time, so a wrong password cannot be narrowed down by timing.
 *  - The owner can read any password back (their decision, asked twice). That is a SECOND, separate
 *    encrypted copy — see `encryptSecret` at the bottom of this file — never the hash above. The
 *    hash stays one-way and remains the only thing a login is checked against.
 */

export const STAFF_ROLES = ["super_admin", "admin", "mechanic"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** The five modes on /scan. `add` creates a product; the rest are counter work. */
export type ScanMode = "add" | "view" | "hold" | "fill" | "pos";

/** Areas a role may or may not WRITE to. Reading is governed by the menu + route gating. */
export type WriteArea = "products" | "customers" | "pos" | "payment" | "stock";

export interface StoredPassword {
  hash: string | null;
  salt: string | null;
  iterations: number | null;
}

/**
 * PBKDF2 rounds for a NEW password. Tuned to stay well inside a Worker's CPU budget for a login,
 * which happens once per session rather than per request. Raise it freely — existing rows keep
 * verifying against the count stored alongside their own hash.
 */
/**
 * PBKDF2 rounds. 100,000 is not a preference — it is Cloudflare Workers' hard ceiling:
 *
 *   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported
 *
 * This shipped at 210,000 and every production login 500'd, while the whole suite stayed green:
 * vitest runs on Node, which happily does 210k. Do not raise it — a number the platform refuses
 * protects nobody, it just breaks signing in (found on prod, 2026-08-04).
 *
 * The count is stored per row, so a password set under a different number keeps verifying.
 */
export const PASSWORD_ITERATIONS = 100_000;

/**
 * The most rounds a Cloudflare Worker will compute. Anything above this throws NotSupportedError.
 *
 * Named separately from PASSWORD_ITERATIONS because they answer different questions: that one is
 * what we CHOOSE for a new credential, this one is what the platform ALLOWS. They happen to be
 * equal today; lowering the choice must not quietly lower the ceiling used to judge old rows.
 */
export const PBKDF2_MAX_ITERATIONS = 100_000;

/**
 * Is this stored credential impossible to verify on a Worker?
 *
 * True only for a credential that EXISTS but was hashed above the platform ceiling — the state that
 * locked the owner out of production (9 Aug 2026). Staff logins shipped at 210,000 rounds; #123
 * lowered the constant for NEW credentials but could not migrate existing rows, because re-hashing
 * needs the plaintext nobody has. Verification runs at the count stored on the row, so those rows
 * throw on every attempt no matter what is typed.
 *
 * Deliberately FALSE for a credential that was never set. "No password" and "a password that can
 * never be checked" are different problems with different fixes, and offering a reset flow to an
 * account that never had one would be noise.
 */
export function credentialNeedsReset(stored: StoredPassword): boolean {
  if (!stored.hash || !stored.salt || !stored.iterations) return false;
  return stored.iterations > PBKDF2_MAX_ITERATIONS;
}

const MIN_PASSWORD_LENGTH = 8;

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 as lowercase hex. Used for session tokens: the cookie holds the raw value, D1 the hash. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

/** A 256-bit session token as 64 hex chars — the raw value that goes in the cookie, never stored. */
export function randomSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(
  password: string,
  opts: { iterations?: number } = {},
): Promise<StoredPassword> {
  const iterations = opts.iterations ?? PASSWORD_ITERATIONS;
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  return { hash: await pbkdf2(password, salt, iterations), salt, iterations };
}

/** Length-independent, value-independent comparison — no early exit on the first differing byte. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: StoredPassword): Promise<boolean> {
  // An account without a usable password can never be logged into. Checked before any hashing so
  // there is no path where a blank column and a blank password meet and agree.
  if (!stored.hash || !stored.salt || !stored.iterations || stored.iterations < 1) return false;
  if (!password) return false;
  // A row hashed above the platform ceiling cannot be checked here — pbkdf2 would throw, which
  // surfaced as a 500 and read to the person signing in as "my password is wrong". Answer false
  // (never true: an uncheckable credential must never be treated as correct) and let the caller
  // ask `credentialNeedsReset` to say something useful instead.
  if (credentialNeedsReset(stored)) return false;
  const candidate = await pbkdf2(password, stored.salt, stored.iterations);
  return constantTimeEquals(candidate, stored.hash);
}

// No I, l, 1, O, 0 — the owner reads these out loud or types them into a chat message.
const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A password for the super admin to hand over. Generated here so it is never a guessable pattern. */
export function randomPassword(length = 16): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join("");
}

/** Why this password is unacceptable, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (!password.trim()) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

/* ── Permissions ──────────────────────────────────────────────────────────────
 * The matrix the owner set on 2026-08-03.
 *
 * WHAT IS ACTUALLY ENFORCED (checked repo-wide, 2026-08-24): `canManageStaff`, in every handler in
 * apps/api/src/staffRoutes.ts, and `canDeleteProduct`, on DELETE /products/:id. The REST of this
 * matrix is defined and unit-tested but **never called outside tests** — the admin UI gates no page
 * on role, and slip-image access runs on the older isSuperAdmin email-list path, not canViewSlips.
 *
 * This comment previously claimed all of them were enforced. They were not, and stating otherwise
 * turned a to-do list into false assurance. A rule only exists where it is CALLED: before relying
 * on any helper below, grep for its call site. A hidden link was never a permission — and neither
 * is a green test on a function nobody invokes.
 */

/** Create staff, change a role, set or reset a password, deactivate. Super admin alone. */
export function canManageStaff(role: StaffRole): boolean {
  return role === "super_admin";
}

/** The Finance page and money totals. Super admin alone — an admin runs orders, not the books. */
export function canViewFinance(role: StaffRole): boolean {
  return role === "super_admin";
}

/** Customers' uploaded bank-slip images (their PII, not ours). Super admin alone. */
export function canViewSlips(role: StaffRole): boolean {
  return role === "super_admin";
}

/**
 * Deleting a product from the catalog. Super admin alone (owner, 2026-08-24).
 *
 * Deliberately STRICTER than `canWrite(role, "products")`, which an admin passes. Editing a
 * product is day-to-day catalog work and mistakes are typed over; deleting archives the row, every
 * list filters archived rows out, and NO screen anywhere brings it back — undoing one means
 * editing D1 by hand. A one-way door belongs to the person who owns the shop.
 *
 * Do not "simplify" this into canWrite: that would hand deletion back to every admin silently.
 */
export function canDeleteProduct(role: StaffRole): boolean {
  return role === "super_admin";
}

/** Sending money back out. Super admin alone. */
export function canRefund(role: StaffRole): boolean {
  return role === "super_admin";
}

/** Assessing a defect claim — the mechanic's whole job, and the others may do it too. */
export function canReviewClaimRole(role: StaffRole): boolean {
  return role === "super_admin" || role === "admin" || role === "mechanic";
}

/**
 * Approving/rejecting the payment slip a customer uploaded against an AirPlus order.
 * NOT the counter Payment page — a mechanic takes money at the counter (see canWrite) but never
 * signs off an online order's payment.
 */
export function canReviewPaymentRole(role: StaffRole): boolean {
  return role === "super_admin" || role === "admin";
}

/** A mechanic reads the catalog and the customer directory; they do not edit either. */
export function canWrite(role: StaffRole, area: WriteArea): boolean {
  if (role !== "mechanic") return true;
  return area === "pos" || area === "payment" || area === "stock";
}

/** Which /scan modes a role may use. A mechanic does everything but create a product. */
export function scanModesFor(role: StaffRole): ScanMode[] {
  const all: ScanMode[] = ["add", "view", "hold", "fill", "pos"];
  return role === "mechanic" ? all.filter((m) => m !== "add") : all;
}

/* ── Reveal-forever passwords ────────────────────────────────────────────────────────────────────
 * The owner asked, twice, to be able to read any staff password back. This is the strongest form of
 * that: AES-GCM under a 256-bit key held in a Worker secret (STAFF_SECRET_KEY), never in D1.
 *
 * What that buys, precisely:
 *  · The owner can reveal any password at any time.
 *  · A stolen copy of the database ALONE reveals nothing — the key is not in it.
 *  · Losing the key breaks only the reveal. Logins still work, because they are checked against the
 *    one-way `password_hash`, not this.
 *  · GCM is authenticated, so a tampered value fails to decrypt rather than returning something
 *    plausible.
 * The weak alternative — a plain-text column — would hand over every staff password with the data.
 */

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// `KeyUsage` is a DOM lib type this package doesn't pull in, and the raw key has to be handed over
// as an ArrayBuffer — a Uint8Array's buffer is typed ArrayBufferLike, which importKey won't take.
async function aesKey(keyHex: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = hexToBytes(keyHex).buffer as ArrayBuffer;
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
}

/** Encrypt for later reveal. Output is base64(iv ‖ ciphertext) — a fresh random IV every time. */
export async function encryptSecret(plain: string, keyHex: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(keyHex, "encrypt"),
    new TextEncoder().encode(plain),
  );
  const joined = new Uint8Array(iv.length + cipher.byteLength);
  joined.set(iv, 0);
  joined.set(new Uint8Array(cipher), iv.length);
  return bytesToBase64(joined);
}

/** Reveal, or null when there is nothing stored, the key is wrong, or the value was tampered with. */
export async function decryptSecret(
  stored: string | null | undefined,
  keyHex: string,
): Promise<string | null> {
  if (!stored) return null;
  try {
    const bytes = base64ToBytes(stored);
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await aesKey(keyHex, "decrypt"),
      cipher,
    );
    return new TextDecoder().decode(plain);
  } catch {
    // Wrong key, wrong length, flipped byte — all the same answer: you get nothing.
    return null;
  }
}

/**
 * The deterministic index a PIN is found by.
 *
 * A PIN is typed with no email, so the row has to be findable FROM the PIN — which rules out a
 * per-row salt. Instead it is HMAC'd with a server-side pepper (STAFF_PIN_PEPPER, a Worker secret):
 * stable enough for a UNIQUE index that stops two staff sharing six digits, and useless to anyone
 * holding the database without the pepper. The slow PBKDF2 `pin_hash` is what actually authorises;
 * this only narrows a million possibilities to one row.
 */
export async function pinLookup(pin: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(pin));
  return toHex(new Uint8Array(mac));
}

/**
 * Changing what the shop CHARGES. Super admin alone (owner, 2026-08-24).
 *
 * Deliberately narrower than `canWrite(role, "products")`, which an admin passes: an admin runs the
 * catalog — names, fitments, photos, stock — but not the prices. An admin may still set a price when
 * ADDING a product, because a product with no price cannot be finished; what they cannot do is move
 * one afterwards.
 */
export function canEditPrice(role: StaffRole): boolean {
  return role === "super_admin";
}

/**
 * Seeing margin. Everyone but a mechanic (owner, 2026-08-24).
 *
 * Enforced by the API withholding the COST, not by hiding a number in the page: profit is price
 * minus cost, so anyone holding the cost can work the margin out themselves. A control that hides
 * the answer while shipping the inputs is decoration.
 */
export function canSeeProfit(role: StaffRole): boolean {
  return role !== "mechanic";
}
