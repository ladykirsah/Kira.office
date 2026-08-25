import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE } from "@/lib/staffSession";
import { GATED_PATH_HEADER } from "@/lib/signedInGate";

/**
 * First pass on every back-office page: bounce anyone with no session cookie at all, and tell the
 * layout which path it is about to draw.
 *
 * THIS IS NOT THE SECURITY BOUNDARY, and must not be mistaken for one. It only checks that a cookie
 * is PRESENT — it cannot verify it, because middleware has no database. The real check happens in
 * the API on every single data request (`requireStaff`), which is what actually protects the data.
 *
 * IT IS ALSO NOT THE SIGN-IN CHECK. A cookie left over from a session that has since been revoked,
 * expired, or whose user was deleted looks identical here to a live one, and used to be waved
 * through into a fully-drawn back office belonging to nobody (24 Aug 2026). That is why it now
 * stamps the pathname into `x-kira-path`: the root layout already asks the API who the token
 * belongs to, and `mustSignIn` turns that answer into the redirect this pass cannot make.
 *
 * Keeping this pass cheap is deliberate: a middleware that tried to validate would add a round trip
 * to every navigation, and would still not be the thing standing between the internet and D1.
 */
export function middleware(request: NextRequest): NextResponse {
  const signedIn = request.cookies.has(STAFF_COOKIE);
  const { pathname, search } = request.nextUrl;

  if (!signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were going, so signing in doesn't dump everyone on the dashboard.
    // `safeNextPath` is what decides whether the value is safe to act on, at the moment it is used.
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Overwrite rather than append: the header is a statement by this middleware about this request,
  // and a caller must not be able to supply their own.
  const headers = new Headers(request.headers);
  headers.set(GATED_PATH_HEADER, pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /**
   * Everything except: the login page and its route handlers (unreachable when signed out would be
   * a deadlock), the owner's rescue page (same reason, and it is the ONLY way back when both the
   * PIN and the password are gone — see `isRecoverPath` in lib/signedInGate.ts), Next's own assets,
   * and /img proxying — product images are public by design and gating them would break the
   * storefront's <img> tags.
   *
   * These are PREFIX exclusions, so `/recovery-anything` escapes this pass too. That is not a hole:
   * the layout's `mustSignIn` matches exactly, so such a page is still sent to the sign-in form,
   * and the API refuses its data either way.
   */
  matcher: [
    "/((?!login|recover|api/staff/login|api/staff/logout|api/worker/img|_next|favicon|icon).*)",
  ],
};
