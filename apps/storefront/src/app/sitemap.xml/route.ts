import { getDb, sitemapProducts } from "@/lib/db";
import { escapeXml, CORE_PAGES } from "@/lib/discovery";
import { productHref } from "@/lib/seo";

// XML sitemap for crawlers: the public core pages plus current product URLs. Fails soft to the core
// pages if D1 is unavailable. (Route handler rather than the app/sitemap.ts convention so the origin
// is derived from the request — the production domain is not fixed yet.)
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const entries: { loc: string; lastmod?: string }[] = CORE_PAGES.map((p) => ({
    loc: `${origin}${p.path}`,
  }));

  try {
    const db = await getDb();
    // Every in-stock product (uncapped, one URL each), stamped with lastmod so crawlers re-fetch a
    // page only when it actually changed. encodeURI keeps "/" and "-" but %-encodes the Thai slug.
    for (const p of await sitemapProducts(db)) {
      entries.push({
        loc: `${origin}${encodeURI(productHref(p))}`,
        lastmod: new Date(p.updatedAt).toISOString(),
      });
    }
  } catch (err) {
    console.error("GET /sitemap.xml catalog read failed", err);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
