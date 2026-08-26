import { apiFetch } from "@/lib/apiFetch";
import { STAFF_COOKIE, STAFF_COOKIE_MAX_AGE } from "@/lib/staffSession";

/**
 * Sign in — two doors, one handler.
 *
 *   { email, password }  → /staff/login          (the full sign-in)
 *   { pin }              → /staff/login-pin      (quick login; the PIN carries no email by design)
 *   { owner: true }      → /staff/login-access   (the owner, on Cloudflare Access alone)
 *   { key }              → /staff/login-recovery (the owner's emergency key — carries no email either)
 *   { practice: true }   → /staff/login-practice (a LOCAL practice copy, no credential at all)
 *
 * The practice door decides nothing here. This route relays it and the API refuses with a 404
 * unless all three of `isPracticeCopy`'s conditions hold — the admin app is not the security
 * boundary and must not be mistaken for one.
 *
 * WHY THIS EXISTS RATHER THAN POSTING STRAIGHT TO THE API: the session cookie has to be set on the
 * admin origin, and a Set-Cookie from api.airplusauto.com would belong to the wrong host. So the
 * browser talks to this route, this route talks to the API server-to-server, and the raw token
 * never reaches client JavaScript — the cookie is httpOnly.
 */
export async function POST(request: Request): Promise<Response> {
  let body: {
    email?: string;
    password?: string;
    pin?: string;
    key?: string;
    owner?: boolean;
    practice?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const usingPractice = body.practice === true;
  const usingOwner = !usingPractice && body.owner === true;
  const usingKey =
    !usingOwner && !usingPractice && typeof body.key === "string" && body.key.length > 0;
  const usingPin =
    !usingOwner &&
    !usingPractice &&
    !usingKey &&
    typeof body.pin === "string" &&
    body.pin.length > 0;
  const path = usingPractice
    ? "/staff/login-practice"
    : usingOwner
      ? "/staff/login-access"
      : usingKey
        ? "/staff/login-recovery"
        : usingPin
          ? "/staff/login-pin"
          : "/staff/login";
  const payload =
    usingOwner || usingPractice
      ? {}
      : usingKey
        ? { key: body.key }
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
  // Stamped by Cloudflare on the browser's request to THIS origin, and forwarded below.
  const clientIp = request.headers.get("cf-connecting-ip") ?? "";

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
        /**
         * Who is actually signing in, carried across the server-to-server hop.
         *
         * The API throttles failed sign-ins per caller (see apps/api/src/loginThrottle.ts), and a
         * subrequest need not carry the edge's `cf-connecting-ip` — so without this the API would
         * be counting the admin WORKER, and every member of staff would share one bucket. Twenty
         * fumbles between them, or one attacker aiming at this proxy, would then shut the whole
         * shop out of its own tills.
         *
         * Safe to forward because the API prefers `cf-connecting-ip` whenever it has one, and only
         * falls back to this. A request off the internet always has the edge's header, so nobody
         * can pick their own bucket by setting this.
         */
        ...(clientIp ? { "x-kira-client-ip": clientIp } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // The API is unreachable. Say so plainly rather than "wrong password", which would send someone
    // hunting for a password that was never the problem.
    return Response.json({ error: "unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const reason = (await upstream.json().catch(() => ({}))) as { reason?: string; error?: string };
    // A caller who has been slowed down is WAITING, not failing. Relayed as itself so the screen can
    // say so — "wrong key" would send someone hunting for a key that was never the problem.
    if (upstream.status === 429) {
      return Response.json({ error: "too_many_attempts" }, { status: 429 });
    }
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
