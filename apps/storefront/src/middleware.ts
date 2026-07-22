import { NextResponse, type NextRequest } from "next/server";
import { isIndexableHost, ROBOTS_NOINDEX_HEADER } from "@/lib/indexability";

/**
 * Stamps X-Robots-Tag: noindex, nofollow on every response from a non-production host.
 *
 * WHY A HEADER AND NOT JUST robots.txt: robots.txt is advisory, and plenty of crawlers ignore it or
 * index a URL they found elsewhere without ever fetching it. X-Robots-Tag travels with the response
 * itself, so a page cannot be indexed even if the crawler never read robots.txt.
 *
 * WHY MIDDLEWARE: the header depends on the REQUEST HOST, and the same build serves both
 * production and staging. next.config.ts headers() is static per build, so it cannot make this
 * decision — middleware is the only place that sees the host.
 *
 * Production is untouched: isIndexableHost allows only airplusauto.com, so the live shop never
 * gets this header. Getting that backwards would deindex the real store, which is why the
 * allow-list is exact-match and tested (src/lib/indexability.test.ts).
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!isIndexableHost(req.nextUrl.hostname)) {
    res.headers.set("X-Robots-Tag", ROBOTS_NOINDEX_HEADER);
  }
  return res;
}

export const config = {
  // Skip Next's internals and the static assets — they are never indexed on their own, and running
  // middleware on every chunk request is pure overhead.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
