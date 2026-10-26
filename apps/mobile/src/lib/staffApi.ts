import { readStaff, type FetchFn, type SignedInStaff } from "./signIn";

/** The header the API reads the raw session token from (apps/api/src/staffSession.ts). */
export const STAFF_SESSION_HEADER = "X-Staff-Session";

/**
 * Who is signed in, asked of the API rather than decided here.
 *
 * Null for every kind of "nobody": an expired or revoked session, a garbled reply, or no network.
 * Treating an unreachable API as signed out is the safe direction — the worst case is being asked to
 * sign in again, never seeing a screen you shouldn't.
 */
export async function currentStaff(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<SignedInStaff | null> {
  try {
    const res = await fetchFn(`${base}/staff/me`, {
      headers: { [STAFF_SESSION_HEADER]: token },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { staff?: unknown };
    return readStaff(body.staff);
  } catch {
    return null;
  }
}

/** Best effort: the phone forgets the session whatever the API says, so this never throws. */
export async function signOut(fetchFn: FetchFn, base: string, token: string): Promise<void> {
  try {
    await fetchFn(`${base}/staff/logout`, {
      method: "POST",
      headers: { [STAFF_SESSION_HEADER]: token },
    });
  } catch {
    // Offline is fine: the session expires on the server by itself.
  }
}
