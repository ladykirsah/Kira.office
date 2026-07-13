import { CORE_PAGES } from "@/lib/discovery";

// Human-readable markdown discovery index (mirrors the /sitemap.xml crawler feed).
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const body = `# AirPlus Public Discovery

Version: 1

AirPlus (อะไหล่แอร์รถยนต์ by Den Air Service) exposes public catalog, marketing, and discovery resources for humans, crawlers, and AI agents.

## Discovery surfaces

- [/llms.txt](${origin}/llms.txt) - short operator hint surface for AI agents.
- [/sitemap.xml](${origin}/sitemap.xml) - XML sitemap for crawlers (pages + products).
- [/sitemap.md](${origin}/sitemap.md) - markdown discovery index.
- [/skills.md](${origin}/skills.md) - public agent task guidance.
- [/rss.xml](${origin}/rss.xml) - RSS feed of new arrivals.

## Core public pages

${CORE_PAGES.map((p) => `- [${p.title}](${origin}${p.path})`).join("\n")}

Individual products live at \`${origin}/products/<product-id>\` and are enumerated in [/sitemap.xml](${origin}/sitemap.xml).

## Agent notes

- Treat prices, stock, flash-sale campaigns, and coupons as changeable; read live product pages for current values.
- Payment: PromptPay QR, bank transfer, cash on delivery (COD). Delivery details at ${origin}/info.
- Browsing and cart are open to everyone; checkout requires phone-OTP login.
- Route exact part-fitment and account-specific questions to LINE Official Account support.
- Use [/sitemap.xml](${origin}/sitemap.xml) for crawler indexing and this file for human-readable discovery.
`;
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
