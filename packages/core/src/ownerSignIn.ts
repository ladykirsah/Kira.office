/**
 * May this request sign in as the shop's owner, on the strength of Cloudflare Access alone?
 *
 * WHY THIS EXISTS. Every recovery path in the staff login ends at "ask a super admin to set a new
 * one" — which is no path at all when the person locked out IS the super admin. There is no
 * bootstrap either: `createStaff` requires an existing super admin, so the first one can only ever
 * have been inserted straight into the database. Between them, a missing row, a credential hashed
 * above the platform's PBKDF2 ceiling, and a PIN matching nobody all end the same way: the owner
 * shut out of their own shop with no way back in short of hand-written SQL (9 Aug 2026).
 *
 * Cloudflare Access already stands in front of the admin and has already proved who the visitor is,
 * by one-time code to that mailbox, before the login page is even reachable. This turns that proof
 * into a way in.
 *
 * WHY IT IS A SEPARATE FUNCTION FROM `isSuperAdmin`. That one answers "treat this request as
 * privileged?" and deliberately returns TRUE when Access is unconfigured, so a local dev machine
 * stays usable. Reusing it here would mean a deployment that lost its ACCESS_* variables would hand
 * a super-admin session to anyone who asked. The two questions look alike and must never share an
 * implementation: this one fails CLOSED on every input it is unsure about.
 *
 * The bar is all three, independently:
 *   1. Access is genuinely configured — no dev-mode opening;
 *   2. the email came from a JWT the caller has already verified against Cloudflare's keys;
 *   3. that email is named in SUPER_ADMIN_EMAILS.
 *
 * Passing Access proves identity, not ownership — anyone the Access policy admits would otherwise
 * become a super admin — which is why (3) is not optional.
 */

export interface OwnerSignInCheck {
  /** ACCESS_TEAM_DOMAIN and ACCESS_AUD are both set, so Access is really enforcing. */
  accessConfigured: boolean;
  /** The email from an ALREADY-VERIFIED Access JWT. Never a value the client supplied. */
  verifiedEmail: string | null;
  /** SUPER_ADMIN_EMAILS, comma or space separated. */
  superAdminEmails?: string;
}

export type OwnerSignInVerdict =
  | { ok: true; email: string }
  | { ok: false; reason: "access_not_configured" | "not_verified" | "not_an_owner" };

/** Exact addresses, lowercased — never a substring test, which a lookalike domain would satisfy. */
function ownerSet(list: string | undefined): Set<string> {
  return new Set(
    (list ?? "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function canSignInAsOwner(check: OwnerSignInCheck): OwnerSignInVerdict {
  if (!check.accessConfigured) return { ok: false, reason: "access_not_configured" };

  const email = (check.verifiedEmail ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "not_verified" };

  // An unset or blank allowlist is the likeliest misconfiguration of the three, so it must read as
  // "nobody", never "everybody".
  const owners = ownerSet(check.superAdminEmails);
  if (owners.size === 0 || !owners.has(email)) return { ok: false, reason: "not_an_owner" };

  return { ok: true, email };
}
