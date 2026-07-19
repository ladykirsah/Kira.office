// robots.txt — crawlers (INCLUDING AI crawlers, which we want for GEO/LLMO) may read everything
// except the private/transactional paths, and are pointed at the sitemap. A route handler (not the
// app/robots.ts convention) so the Sitemap origin is derived from the request, matching sitemap.xml.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const body = [
    "User-agent: *",
    "Allow: /",
    // Private / transactional — no SEO value, and shouldn't be indexed.
    "Disallow: /api/",
    "Disallow: /account",
    "Disallow: /checkout",
    "Disallow: /cart",
    "Disallow: /login",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
