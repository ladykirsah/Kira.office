/**
 * Response security headers for the storefront.
 *
 * The api Worker has always set its own (see STATIC_SECURITY_HEADERS in apps/api/src/index.ts) but
 * the storefront shipped with none at all — no HSTS, no framing protection, no sniffing protection.
 * That matters most at checkout, where a clickjacked "confirm order" is an actual order.
 *
 * Lives in its own module, not inline in next.config.ts, so the policy is asserted by tests rather
 * than reviewed by eye.
 *
 * ON CSP — deliberately framing-only. A full Content-Security-Policy on a Next.js app has to
 * account for its inline bootstrap script (needs a nonce or a hash) and every image/font origin;
 * getting it wrong does not degrade, it takes the whole shop down. `frame-ancestors` is the part
 * that is safe to enforce with no nonce plumbing, so it goes in now. A full policy is worth doing
 * later behind Report-Only first, with a real report endpoint to watch.
 */
export type SecurityHeader = { key: string; value: string };

export const SECURITY_HEADERS: SecurityHeader[] = [
  // One year, and every subdomain. api. and admin. are on this zone too and are HTTPS-only, so
  // includeSubDomains costs nothing. No `preload` — that is a public-list submission and slow to undo.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Both framing headers: X-Frame-Options for older browsers, frame-ancestors for current ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Origin yes, path no. Keeps referrer data useful for SEO without leaking which product a
  // customer was looking at to whatever they click through to.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The shop asks for none of these; denying them means an injected script cannot ask either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** The `headers()` rule set for next.config.ts — one rule, every path. */
export async function securityHeaderRules(): Promise<
  { source: string; headers: SecurityHeader[] }[]
> {
  return [{ source: "/:path*", headers: SECURITY_HEADERS }];
}
