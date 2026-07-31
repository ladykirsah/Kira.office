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
 * Decide whether `key` may be served. Claim evidence is readable by any authenticated admin; a
 * payment slip is super-admin-only; anything outside those namespaces is refused outright so a
 * guessed key can never reach another object (backups, product images, etc.).
 */
export function privateFileAccess(key: string, ctx: AccessContext): PrivateFileAccess {
  if (/^claim\//.test(key)) return "ok";
  if (/^slip\//.test(key)) return isSuperAdmin(ctx.email, ctx) ? "ok" : "forbidden";
  return "not_allowed";
}
