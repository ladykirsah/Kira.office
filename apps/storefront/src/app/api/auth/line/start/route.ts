import { NextResponse } from "next/server";
import { buildLineAuthorizeUrl, pkceChallengeS256 } from "@l-shopee/core";
import { getEnv } from "@/lib/db";
import {
  LINE_FLOW_TTL_S,
  LINE_OAUTH_COOKIE,
  lineRedirectUri,
  randomUrlToken,
} from "@/lib/lineAuth";

/**
 * GET /api/auth/line/start — begin LINE Login. Mints a CSRF `state` + PKCE verifier,
 * stashes them (with the post-login return path) in a short-lived httpOnly cookie,
 * and redirects the browser to LINE's consent screen. The matching /callback route
 * completes the exchange.
 */

/** Only same-site absolute paths may be a post-login redirect target. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
}

export async function GET(request: Request): Promise<Response> {
  const env = await getEnv();
  const url = new URL(request.url);
  if (!env.LINE_CHANNEL_ID) {
    return NextResponse.redirect(new URL("/login?e=line_unavailable", url.origin));
  }

  const next = safeNext(url.searchParams.get("next"));
  const state = randomUrlToken(16);
  const verifier = randomUrlToken(32);
  const codeChallenge = await pkceChallengeS256(verifier);

  const authorizeUrl = buildLineAuthorizeUrl({
    channelId: env.LINE_CHANNEL_ID,
    redirectUri: lineRedirectUri(url.origin),
    state,
    codeChallenge,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(LINE_OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LINE_FLOW_TTL_S,
  });
  return res;
}
