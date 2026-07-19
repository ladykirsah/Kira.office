import { getDb, listCatalog } from "@/lib/db";
import { escapeXml } from "@/lib/discovery";
import { productHref } from "@/lib/seo";

// RSS 2.0 feed of the newest catalog items (AirPlus has no articles yet, so "new arrivals" is the
// content stream). Fails soft to an empty-but-valid channel if D1 is unavailable.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;

  let items = "";
  try {
    const db = await getDb();
    const products = await listCatalog(db, { limit: 30 });
    items = products
      .map((p) => {
        const url = `${origin}${encodeURI(productHref(p))}`;
        const desc =
          [p.typeName, p.brandName, p.fitmentShort ? `fits ${p.fitmentShort}` : null]
            .filter(Boolean)
            .join(" · ") || "อะไหล่แอร์รถยนต์ AirPlus";
        return `    <item>
      <title>${escapeXml(p.name)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(desc)}</description>
    </item>`;
      })
      .join("\n");
  } catch (err) {
    console.error("GET /rss.xml catalog read failed", err);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
  <channel>
    <title>AirPlus — สินค้าใหม่ (New arrivals)</title>
    <link>${origin}/products</link>
    <description>New and updated car air-conditioning (A/C) parts at AirPlus by Den Air Service.</description>
    <language>th</language>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
