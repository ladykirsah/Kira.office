import { base64UrlEncode, decodeJwtClaims, LINE_TOKEN_URL } from "@l-shopee/core";
import type { StorefrontEnv as Env } from "./db";

/**
 * Server-side LINE Login glue: random secrets, the code→token exchange (holds the
 * channel secret), id_token claim validation, and the short-lived "new LINE user
 * needs a phone" hand-off stored in KV. Pure/deterministic bits live in
 * @l-shopee/core (lineLogin.ts); anything touching the network or a secret is here.
 */

/** httpOnly cookie carrying the in-flight OAuth state + PKCE verifier (start → callback). */
export const LINE_OAUTH_COOKIE = "ap_line_oauth";
/** httpOnly cookie carrying the KV token for a pending (phone-less) LINE registration. */
export const LINE_PENDING_COOKIE = "ap_line_pending";
/** Seconds a half-finished LINE flow stays valid. */
export const LINE_FLOW_TTL_S = 600;

/** A URL-safe random token from `bytes` bytes of entropy (default 32 → 43 chars). */
export function randomUrlToken(bytes = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** The callback URL LINE redirects back to, derived from the incoming request's origin. */
export function lineRedirectUri(origin: string): string {
  return `${origin}/api/auth/line/callback`;
}

/** Exchange an authorization code for LINE's id_token. Throws on any non-OK response. */
export async function exchangeCodeForIdToken(
  env: Env,
  params: { code: string; redirectUri: string; codeVerifier: string },
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: env.LINE_CHANNEL_ID ?? "",
    client_secret: env.LINE_CHANNEL_SECRET ?? "",
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(LINE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LINE token exchange failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("LINE token response missing id_token");
  return json.id_token;
}

export interface LineIdentity {
  lineUserId: string;
  name: string;
}

/**
 * Validate an id_token that came straight from LINE's token endpoint (trusted TLS
 * transport) and pull the LINE user id + display name. Checks issuer, audience
 * (our channel), and expiry. Returns null if anything doesn't line up.
 */
export function lineIdentityFromIdToken(
  idToken: string,
  channelId: string,
  nowMs: number,
): LineIdentity | null {
  const claims = decodeJwtClaims(idToken);
  if (!claims) return null;
  if (claims.iss !== "https://access.line.me") return null;
  if (claims.aud !== channelId) return null;
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= nowMs) return null;
  if (typeof claims.sub !== "string" || !claims.sub) return null;
  const name = typeof claims.name === "string" ? claims.name : "";
  return { lineUserId: claims.sub, name };
}

/** Stash a pending (new LINE user, no phone yet) identity in KV; returns its cookie token. */
export async function stashLinePending(env: Env, identity: LineIdentity): Promise<string> {
  const token = randomUrlToken(24);
  await env.KV.put(`line_pending:${token}`, JSON.stringify(identity), {
    expirationTtl: LINE_FLOW_TTL_S,
  });
  return token;
}

/** Read a pending LINE identity WITHOUT consuming it (used to pre-fill the register form). */
export async function peekLinePending(env: Env, token: string): Promise<LineIdentity | null> {
  const raw = await env.KV.get(`line_pending:${token}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LineIdentity;
    if (typeof parsed.lineUserId === "string" && typeof parsed.name === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Read + delete a pending LINE identity by its token. Null if missing/expired. */
export async function takeLinePending(env: Env, token: string): Promise<LineIdentity | null> {
  const key = `line_pending:${token}`;
  const raw = await env.KV.get(key);
  if (!raw) return null;
  await env.KV.delete(key);
  try {
    const parsed = JSON.parse(raw) as LineIdentity;
    if (typeof parsed.lineUserId === "string" && typeof parsed.name === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}
