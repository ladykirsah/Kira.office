import { NextResponse } from "next/server";
import { getEnv } from "@/lib/db";
import { createSession, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/authCore";
import {
  exchangeCodeForIdToken,
  lineIdentityFromIdToken,
  lineRedirectUri,
  stashLinePending,
  LINE_FLOW_TTL_S,
  LINE_OAUTH_COOKIE,
  LINE_PENDING_COOKIE,
} from "@/lib/lineAuth";

/**
 * GET /api/auth/line/callback — LINE redirects here with `code` + `state`. We verify
 * the state against the cookie from /start, exchange the code for an id_token (using
 * the channel secret, server-to-server), and either log the returning member in or —
 * for a first-time LINE user — hand off to /register/line to collect a phone + PDPA
 * consent (a phone-less customer can't exist: storefront_customers.phone is NOT NULL).
 *
 * This is a GET redirect callback, so it can't use guardMutation; the `state` cookie
 * is its CSRF defense and PKCE binds the code to our /start request.
 */

function redirectClearingOauth(request: Request, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, new URL(request.url).origin));
  res.cookies.delete(LINE_OAUTH_COOKIE);
  return res;
}

export async function GET(request: Request): Promise<Response> {
  const env = await getEnv();
  const url = new URL(request.url);

  if (url.searchParams.get("error")) return redirectClearingOauth(request, "/login?e=line_denied");

  const rawCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LINE_OAUTH_COOKIE}=`))
    ?.slice(LINE_OAUTH_COOKIE.length + 1);
  if (!rawCookie) return redirectClearingOauth(request, "/login?e=line_state");

  let saved: { state: string; verifier: string; next: string };
  try {
    saved = JSON.parse(decodeURIComponent(rawCookie));
  } catch {
    return redirectClearingOauth(request, "/login?e=line_state");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== saved.state)
    return redirectClearingOauth(request, "/login?e=line_state");
  if (!env.LINE_CHANNEL_ID || !env.LINE_CHANNEL_SECRET)
    return redirectClearingOauth(request, "/login?e=line_unavailable");

  let identity;
  try {
    const idToken = await exchangeCodeForIdToken(env, {
      code,
      redirectUri: lineRedirectUri(url.origin),
      codeVerifier: saved.verifier,
    });
    identity = lineIdentityFromIdToken(idToken, env.LINE_CHANNEL_ID, Date.now());
  } catch (err) {
    console.error("LINE callback exchange failed", err);
    return redirectClearingOauth(request, "/login?e=line_exchange");
  }
  if (!identity) return redirectClearingOauth(request, "/login?e=line_token");

  const db = env.DB;
  const now = Date.now();
  const safeNext =
    saved.next.startsWith("/") && !saved.next.startsWith("//") ? saved.next : "/account";

  const existing = await db
    .prepare(`SELECT id FROM storefront_customers WHERE line_user_id = ?`)
    .bind(identity.lineUserId)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE storefront_customers SET last_login_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, existing.id)
      .run();
    const session = await createSession(db, existing.id);
    const res = redirectClearingOauth(request, safeNext);
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions());
    return res;
  }

  // First-time LINE user — no account yet. Stash the verified identity and collect
  // a phone + PDPA consent before creating the row.
  const pendingToken = await stashLinePending(env, identity);
  const res = redirectClearingOauth(request, `/register/line?next=${encodeURIComponent(safeNext)}`);
  res.cookies.set(LINE_PENDING_COOKIE, pendingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LINE_FLOW_TTL_S,
  });
  return res;
}
