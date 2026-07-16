import type { StorefrontEnv } from "./db";

/**
 * Cloudflare Turnstile server-side verification — the primary gate against SMS-pumping fraud on
 * the OTP-send endpoint (the D1 throttles are the backstop). When TURNSTILE_SECRET_KEY is unset
 * (local dev / not yet provisioned by the owner) verification passes open — the throttles still
 * apply. The site key for the widget ships to the client via NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */
export async function verifyTurnstile(
  env: StorefrontEnv,
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return Boolean(body?.success);
  } catch {
    // Verification service unreachable: fail CLOSED — an attacker shouldn't get free sends by
    // degrading the verifier; a real user just retries.
    return false;
  }
}
