import { apiFetch } from "@/lib/apiFetch";
import { STAFF_COOKIE, STAFF_COOKIE_MAX_AGE } from "@/lib/staffSession";

/**
 * Sign in — two doors, one handler.
 *
 *   { email, password }  → /staff/login       (the full sign-in)
 *   { pin }              → /staff/login-pin   (quick login; the PIN carries no email by design)
 *
 * WHY THIS EXISTS RATHER THAN POSTING STRAIGHT TO THE API: the session cookie has to be set on the
 * admin origin, and a Set-Cookie from api.airplusauto.com would belong to the wrong host. So the
 * browser talks to this route, this route talks to the API server-to-server, and the raw token
 * never reaches client JavaScript — the cookie is httpOnly.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { email?: string; password?: string; pin?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const usingPin = typeof body.pin === "string" && body.pin.length > 0;
  const path = usingPin ? "/staff/login-pin" : "/staff/login";
  const payload = usingPin
    ? { pin: body.pin }
    : { email: body.email ?? "", password: body.password ?? "" };

  let upstream: Response;
  try {
    upstream = await apiFetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // The API is unreachable. Say so plainly rather than "wrong password", which would send someone
    // hunting for a password that was never the problem.
    return Response.json({ error: "unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const reason = (await upstream.json().catch(() => ({}))) as { reason?: string };
    return Response.json({ error: "invalid", reason: reason.reason ?? "invalid" }, { status: 401 });
  }

  const { token, staff } = (await upstream.json()) as {
    token: string;
    staff: { name: string; role: string };
  };

  const res = Response.json({ ok: true, staff });
  res.headers.append(
    "set-cookie",
    [
      `${STAFF_COOKIE}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${STAFF_COOKIE_MAX_AGE}`,
      // Secure everywhere except plain-http local dev, where the browser would drop it.
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return res;
}

// A route file may only export the handlers and Next's own route config — an extra export here is
// a build error, not a lint nit.
export const dynamic = "force-dynamic";
