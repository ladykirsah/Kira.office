/**
 * Build-time guard on NEXT_PUBLIC_API_BASE — the admin's twin of the storefront's imgBaseGuard.
 *
 * WHY: `NEXT_PUBLIC_*` is inlined into the bundle at BUILD time, not read at runtime. A production
 * build run from a shell that still had this pointing at a dev server would ship an admin whose
 * every browser call goes to `http://localhost:8799`. Every page would be dead, and types, tests,
 * the build and the deploy would all pass in silence.
 *
 * That is not hypothetical. The storefront shipped exactly this bug with NEXT_PUBLIC_IMG_BASE on
 * 2026-07-22 and broke every product photo for roughly 16 hours; it was found by a human looking at
 * the page, not by any check. This guard was the follow-up flagged when that one landed.
 *
 * Unset is the normal production path — apiFetch falls back to the real host — so only an
 * explicitly wrong value fails. Dev builds are exempt: pointing at localhost is the whole purpose
 * of the override under `next dev`.
 */

const UNREACHABLE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isUnreachable(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return UNREACHABLE_HOSTNAMES.has(h) || h.endsWith(".local");
}

/** Throw if `value` could not serve the deployed admin. */
export function assertDeployableApiBase(
  value: string | undefined,
  isProductionBuild: boolean,
): void {
  if (!isProductionBuild || !value) return;

  const fail = (reason: string): never => {
    throw new Error(
      `NEXT_PUBLIC_API_BASE is set to "${value}", which ${reason}.\n\n` +
        `This value is inlined into the bundle at build time, so deploying it would leave every ` +
        `admin page unable to reach the API.\n\n` +
        `Fix: leave NEXT_PUBLIC_API_BASE unset for a production build — apps/admin/src/lib/apiFetch.ts ` +
        `already falls back to the real API host. For a staging build set it to the staging API. ` +
        `If a dev server exported it into your shell, clear it and rebuild:\n` +
        `  env -u NEXT_PUBLIC_API_BASE npm run deploy\n`,
    );
  };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("is not a valid absolute URL");
  }

  if (isUnreachable(url.hostname)) {
    return fail("points at this machine and is unreachable from a browser");
  }

  // The admin is served over https, so an http API call is blocked as mixed content.
  if (url.protocol !== "https:") {
    return fail("uses plain http, which browsers block as mixed content on the https admin");
  }
}
