import { cookies } from "next/headers";
import { apiFetch } from "./apiFetch";

/**
 * The admin app's half of staff logins.
 *
 * WHO HOLDS WHAT: the browser holds an httpOnly cookie on the admin origin; the API holds the
 * session row and is the only thing that decides whether a token is good. This file just carries
 * the token between the two — it never makes an authorisation decision of its own, because the API
 * is a separate public hostname and has to be able to defend itself.
 *
 * The cookie cannot be set from a server component (Next 15 allows that only in route handlers and
 * server actions), which is why signing in goes through /api/staff/login rather than a form action.
 */

export const STAFF_COOKIE = "kira_staff";
/** Matches the API's session lifetime; the API's own expiry is the authoritative one. */
export const STAFF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
/** Header the API reads the raw token from. */
export const STAFF_SESSION_HEADER = "X-Staff-Session";

export type StaffRole = "super_admin" | "admin" | "mechanic";

export interface SignedInStaff {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
}

/** The raw token from the cookie, or null. */
export async function staffToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STAFF_COOKIE)?.value ?? null;
}

/**
 * Who is signed in, asked of the API rather than decided here.
 *
 * Returns null for "nobody" — an expired session, a revoked one, a person who has been switched
 * off, or an API that cannot be reached. Treating an unreachable API as "signed out" is the safe
 * direction: the worst case is being asked to sign in again, never seeing a page you shouldn't.
 */
export async function currentStaff(): Promise<SignedInStaff | null> {
  const token = await staffToken();
  if (!token) return null;
  try {
    const res = await apiFetch("/staff/me", {
      cache: "no-store",
      headers: { [STAFF_SESSION_HEADER]: token },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { staff: SignedInStaff }).staff;
  } catch {
    return null;
  }
}
