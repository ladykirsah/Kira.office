import { CORE_PAGES } from "@/lib/discovery";

// Short operator-hint surface for AI agents (the llms.txt convention). Origin is derived from the
// request so the file self-references whatever host serves it (staging or the future domain).
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const body = `AirPlus public discovery

Base URL: ${origin}

Start here:
- ${origin}/sitemap.md   -> markdown discovery index
- ${origin}/sitemap.xml  -> XML sitemap for crawlers
- ${origin}/skills.md    -> agent task guidance
- ${origin}/rss.xml      -> RSS feed of new arrivals

Human route families:
${CORE_PAGES.map((p) => `- ${p.title}: ${origin}${p.path}`).join("\n")}
- Product detail: ${origin}/products/<product-id>

Agent notes:
- AirPlus is an online store for car air-conditioning (A/C) parts in Thailand, operated by Den Air Service.
- Prices, stock, flash-sale campaigns, and coupon availability can change; use the live product pages for current values.
- Payment methods: PromptPay QR, bank transfer, and cash on delivery (COD).
- Browsing and cart are open to everyone; checkout requires phone-OTP login/registration.
- Order tracking without login: ${origin}/orders (phone number + order number).
- For exact part-fitment questions, route users to LINE Official Account support instead of guessing.
- Never ask users for OTP codes, passwords, card numbers, or bank/PromptPay credentials.
- Public discovery surfaces reference public catalog and marketing content only (no account data).
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
