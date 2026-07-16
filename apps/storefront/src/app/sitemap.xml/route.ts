import { getDb, listCatalog } from "@/lib/db";
import { escapeXml, CORE_PAGES } from "@/lib/discovery";

// XML sitemap for crawlers: the public core pages plus current product URLs. Fails soft to the core
// pages if D1 is unavailable. (Route handler rather than the app/sitemap.ts convention so the origin
// is derived from the request — the production domain is not fixed yet.)
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const urls: string[] = CORE_PAGES.map((p) => `${origin}${p.path}`);

  try {
    const db = await getDb();
    const products = await listCatalog(db, { limit: 100 });
    for (const p of products) {
      urls.push(`${origin}/products/${encodeURIComponent(p.productId)}`);
    }
  } catch (err) {
    console.error("GET /sitemap.xml catalog read failed", err);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
