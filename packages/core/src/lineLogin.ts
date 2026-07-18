/**
 * LINE Login (OAuth 2.1 / OpenID Connect) helpers for the AirPlus storefront.
 *
 * Only the deterministic, network-free parts live here so they can be unit-tested:
 * the PKCE S256 challenge and the authorize-URL builder. The random code_verifier,
 * the code→token exchange, and id_token verification (LINE's /oauth2/v2.1/verify)
 * happen in the storefront route, which holds the channel secret and does the fetch.
 */

/** LINE's OAuth authorization endpoint (user is redirected here to log in). */
export const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
/** Token exchange endpoint (server-to-server, POST with the channel secret). */
export const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
/** id_token verification endpoint (LINE does the JWT crypto for us). */
export const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/** URL-safe base64 of raw bytes, unpadded (RFC 4648 §5): + → -, / → _, no =. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode URL-safe base64 (unpadded) back to raw bytes. */
export function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Decode the claims (payload) of a JWT WITHOUT verifying its signature.
 * Safe only for tokens obtained directly from LINE's token endpoint over TLS
 * (server-to-server) — never for a token that arrived via the browser. Returns
 * null for anything that isn't a three-segment JWT with a JSON payload.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = new TextDecoder().decode(base64UrlDecode(parts[1]!));
    const claims: unknown = JSON.parse(json);
    if (typeof claims !== "object" || claims === null) return null;
    return claims as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** PKCE S256 code challenge for a given verifier: base64url(SHA-256(verifier)). */
export async function pkceChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Build the LINE authorize URL the browser is redirected to (state + PKCE + scope). */
export function buildLineAuthorizeUrl(p: {
  channelId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
  nonce?: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: p.channelId,
    redirect_uri: p.redirectUri,
    state: p.state,
    scope: p.scope ?? "openid profile",
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
  });
  if (p.nonce) q.set("nonce", p.nonce);
  return `${LINE_AUTHORIZE_URL}?${q.toString()}`;
}
