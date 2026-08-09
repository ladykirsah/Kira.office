import { apiFetch } from "@/lib/apiFetch";
import { STAFF_COOKIE, STAFF_COOKIE_MAX_AGE } from "@/lib/staffSession";

/**
 * Sign in — two doors, one handler.
 *
 *   { email, password }  → /staff/login        (the full sign-in)
 *   { pin }              → /staff/login-pin    (quick login; the PIN carries no email by design)
 *   { owner: true }      → /staff/login-access (the owner, on Cloudflare Access alone)
 *
 * WHY THIS EXISTS RATHER THAN POSTING STRAIGHT TO THE API: the session cookie has to be set on the
 * admin origin, and a Set-Cookie from api.airplusauto.com would belong to the wrong host. So the
 * browser talks to this route, this route talks to the API server-to-server, and the raw token
 * never reaches client JavaScript — the cookie is httpOnly.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { email?: string; password?: string; pin?: string; owner?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const usingOwner = body.owner === true;
  const usingPin = !usingOwner && typeof body.pin === "string" && body.pin.length > 0;
  const path = usingOwner ? "/staff/login-access" : usingPin ? "/staff/login-pin" : "/staff/login";
  const payload = usingOwner
    ? {}
    : usingPin
      ? { pin: body.pin }
      : { email: body.email ?? "", password: body.password ?? "" };

  /**
   * The owner door proves nothing by itself — the proof is the Access JWT, which Cloudflare puts on
   * the browser's request to THIS origin. It has to be carried upstream by hand: apiFetch talks
   * server-to-server, so nothing of the visitor's request travels with it otherwise, and the API
   * would see no token and refuse.
   *
   * Forwarded, never minted here: this route only relays what Cloudflare already signed, and the API
   * verifies it against Cloudflare's keys before believing a word of it.
   */
  const accessJwt =
    request.headers.get("Cf-Access-Jwt-Assertion") ??
    /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1] ??
    "";

  let upstream: Response;
  try {
    upstream = await apiFetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessJwt ? { "Cf-Access-Jwt-Assertion": accessJwt } : {}),
      },
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
