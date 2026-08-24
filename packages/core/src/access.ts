/**
 * Who may read a private order file (super-admin gate for bank slips), kept pure so it can be tested
 * without a Cloudflare Access JWT in hand. The API route does the R2 read; the decision lives here.
 *
 * FAIL-OPEN WHEN UNCONFIGURED, on purpose: local dev runs with Access switched off (no ACCESS_AUD),
 * exactly as `requireAccess` does — so a developer can see slips. In production Access IS configured,
 * and then a slip is served only to an email on the super-admin list. Never rely on this being open.
 */

export interface AccessContext {
  /** The Access-verified email, or null when unauthenticated / Access is off. */
  email: string | null;
  /** Comma/space-separated super-admin emails (env.SUPER_ADMIN_EMAILS). */
  superAdminEmails?: string | null;
  /** Whether Cloudflare Access is configured (env.ACCESS_AUD set). Off ⇒ local dev. */
  accessConfigured: boolean;
}

function parseEmails(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when this email may see super-admin-only material (bank slips). */
export function isSuperAdmin(email: string | null, ctx: Omit<AccessContext, "email">): boolean {
  if (!ctx.accessConfigured) return true; // local dev: Access off ⇒ open, mirrors requireAccess
  if (!email) return false;
  return parseEmails(ctx.superAdminEmails).has(email.trim().toLowerCase());
}

export type PrivateFileAccess = "ok" | "forbidden" | "not_allowed";

/**
 * Decide whether `key` may be served — the NAMESPACE policy, nothing else.
 *
 * Claim evidence is readable by any signed-in staff member; a customer's payment slip needs
 * `canSeeSlips`; anything outside those namespaces is refused outright, so a guessed key can never
 * reach another object (backups, product images, database dumps).
 *
 * WHO the caller is arrives as one boolean, decided by the route from the STAFF SESSION. Until
 * 2026-08-24 this function took an Access email plus `accessConfigured` and answered "ok" for a
 * bank slip whenever Access was unconfigured — a fail-open default on customer financial PII. The
 * Access email had also stopped naming whoever is operating the admin, since several people can
 * share one Access session and then sign in as different staff.
 */
export function privateFileAccess(key: string, canSeeSlips: boolean): PrivateFileAccess {
  if (/^claim\//.test(key)) return "ok";
  // Our OUTGOING refund transfer slip — proof we paid the customer back, not their bank PII, and shown
  // to the customer too. Any admin, like claim evidence. (Checked before slip/ so the hyphen is safe.)
  if (/^refund-slip\//.test(key)) return "ok";
  if (/^slip\//.test(key)) return canSeeSlips ? "ok" : "forbidden";
  return "not_allowed";
}

/**
 * The three back-office roles for Zone-A gating, resolved from email lists — the SAME lightweight
 * pattern as `isSuperAdmin`, NOT the dormant users-table AppRole system. Distinct because the actions
 * split by who does the work: a mechanic assesses a defect claim; a mechanic does NOT approve payments.
 *
 *   super_admin — SUPER_ADMIN_EMAILS. Sees everything.
 *   mechanic    — MECHANIC_EMAILS. Reviews claims; NOT payments/COD.
 *   admin       — every other Access-authenticated back-office user. Reviews payments/COD; NOT claims.
 *
 * Local dev (Access off) resolves to super_admin so a developer can exercise every Zone-A block.
 */
export type ViewerRole = "super_admin" | "mechanic" | "admin";

export interface RoleContext {
  superAdminEmails?: string | null;
  /** Comma/space-separated mechanic emails (env.MECHANIC_EMAILS). */
  mechanicEmails?: string | null;
  accessConfigured: boolean;
}

export function viewerRole(email: string | null, ctx: RoleContext): ViewerRole {
  if (!ctx.accessConfigured) return "super_admin"; // local dev: Access off ⇒ full access
  const e = (email ?? "").trim().toLowerCase();
  if (e && parseEmails(ctx.superAdminEmails).has(e)) return "super_admin"; // super wins over mechanic
  if (e && parseEmails(ctx.mechanicEmails).has(e)) return "mechanic";
  return "admin";
}

/** Claim approve/reject — the mechanic's call, and the super-admin's. Never a plain admin. */
export function canReviewClaim(role: ViewerRole): boolean {
  return role === "super_admin" || role === "mechanic";
}

/** Payment-slip + COD approval — super-admin and admin, but never a mechanic. */
export function canReviewPayment(role: ViewerRole): boolean {
  return role === "super_admin" || role === "admin";
}
