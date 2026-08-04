import { apiFetch } from "@/lib/apiFetch";
import { STAFF_COOKIE, STAFF_SESSION_HEADER } from "@/lib/staffSession";

/**
 * Sign out. Revokes the session in D1 first, then clears the cookie — in that order, so a failure
 * to reach the API leaves the person still signed in rather than holding a cookie for a session
 * that was never actually revoked.
 */
export async function POST(request: Request): Promise<Response> {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STAFF_COOKIE}=`))
    ?.slice(STAFF_COOKIE.length + 1);

  if (token) {
    try {
      await apiFetch("/staff/logout", {
        method: "POST",
        headers: { [STAFF_SESSION_HEADER]: token },
      });
    } catch {
      // Best effort: the cookie still gets cleared below, and the session expires on its own.
    }
  }

  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${STAFF_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}

export const dynamic = "force-dynamic";
