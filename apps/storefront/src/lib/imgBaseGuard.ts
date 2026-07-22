/**
 * Build-time guard on NEXT_PUBLIC_IMG_BASE.
 *
 * WHY THIS EXISTS (2026-07-22): a `wrangler deploy` ran from a shell that still had
 * NEXT_PUBLIC_IMG_BASE pointing at the local dev server — `.claude/launch.json` runs
 * `wrangler dev --port 8788`. NEXT_PUBLIC_* is inlined at BUILD time, so every <img> on the live
 * storefront shipped as `http://localhost:8788/img/…`. Every product photo was broken for
 * customers, and neither the build nor the deploy said a word: both exited 0.
 *
 * A wrong image host is invisible to every check we had — types pass, tests pass, the deploy
 * succeeds, the page returns 200. Only a human looking at the rendered page catches it. So the
 * check has to live at the one point where the bad value becomes permanent: the production build.
 *
 * Called from next.config.ts. Dev builds are exempt, because pointing at localhost is exactly what
 * the override is FOR when running `next dev`.
 */

/** Hosts that can never be reachable from a customer's browser. */
const UNREACHABLE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isUnreachable(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // `.local` is mDNS (a developer's own machine on the LAN) — fine locally, never for customers.
  return UNREACHABLE_HOSTNAMES.has(h) || h.endsWith(".local");
}

/**
 * Throw if `value` could not possibly serve images to a customer.
 *
 * `undefined` is allowed and is the normal production path: img.ts falls back to the real API host,
 * so an unset variable is correct. Only an explicitly wrong value is an error.
 */
export function assertDeployableImgBase(
  value: string | undefined,
  isProductionBuild: boolean,
): void {
  if (!isProductionBuild || !value) return;

  const fail = (reason: string): never => {
    throw new Error(
      `NEXT_PUBLIC_IMG_BASE is set to "${value}", which ${reason}.\n\n` +
        `This value is inlined into the bundle at build time, so deploying it would break every ` +
        `product image on the live storefront.\n\n` +
        `Fix: leave NEXT_PUBLIC_IMG_BASE unset for production builds — apps/storefront/src/lib/img.ts ` +
        `already falls back to the real API host. If it is exported in your shell (a dev server ` +
        `sets it), unset it and rebuild:\n` +
        `  env -u NEXT_PUBLIC_IMG_BASE npm run deploy\n`,
    );
  };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("is not a valid absolute URL");
  }

  if (isUnreachable(url.hostname)) {
    return fail("points at this machine and is unreachable from a customer's browser");
  }

  // The storefront is https-only (HSTS, see securityHeaders.ts). An http:// image on an https page
  // is blocked as mixed content, so it fails just as completely as a localhost URL.
  if (url.protocol !== "https:") {
    return fail("uses plain http, which browsers block as mixed content on the https storefront");
  }
}
