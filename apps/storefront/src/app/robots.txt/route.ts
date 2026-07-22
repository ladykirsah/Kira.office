// robots.txt — crawlers (INCLUDING AI crawlers, which we want for GEO/LLMO) may read everything
// except the private/transactional paths, and are pointed at the sitemap. A route handler (not the
// app/robots.ts convention) so the Sitemap origin is derived from the request, matching sitemap.xml.
//
// Non-production hosts (staging, workers.dev previews, localhost) get a blanket Disallow instead —
// see src/lib/indexability.ts. Staging is publicly reachable, and a second crawlable copy of the
// shop would compete with the real store in search results.
import { robotsBody } from "@/lib/indexability";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  return new Response(robotsBody(origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
