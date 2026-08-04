import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE } from "@/lib/staffSession";

/**
 * Send signed-out visitors to /login.
 *
 * THIS IS NOT THE SECURITY BOUNDARY, and must not be mistaken for one. It only checks that a cookie
 * is PRESENT — it cannot verify it, because middleware has no database. The real check happens in
 * the API on every single data request (`requireStaff`), which is what actually protects the data.
 * All this does is spare someone a page full of empty panels and a redirect they'd hit anyway.
 *
 * Keeping it this cheap is deliberate: a middleware that tried to validate would add a round trip
 * to every navigation, and would still not be the thing standing between the internet and D1.
 */
export function middleware(request: NextRequest): NextResponse {
  const signedIn = request.cookies.has(STAFF_COOKIE);
  const { pathname, search } = request.nextUrl;

  if (!signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were going, so signing in doesn't dump everyone on the dashboard.
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  /**
   * Everything except: the login page and its route handlers (unreachable when signed out would be
   * a deadlock), Next's own assets, and /img proxying — product images are public by design and
   * gating them would break the storefront's <img> tags.
   */
  matcher: ["/((?!login|api/staff/login|api/staff/logout|api/worker/img|_next|favicon|icon).*)"],
};
