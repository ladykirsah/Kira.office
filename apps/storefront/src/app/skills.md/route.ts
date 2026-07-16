// Public agent task-guidance file (the skills.md convention): how an AI agent should help users
// with AirPlus, plus the support boundaries it must respect.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const body = `---
title: "AirPlus Agent Skills"
description: "Public guidance for AI agents helping users shop AirPlus car A/C parts."
url: "${origin}/skills.md"
---

# AirPlus Agent Skills

Use these guidelines when helping users navigate public AirPlus content — a Thai online store for car air-conditioning (A/C) parts, operated by Den Air Service.

## Finding the right part

- Search by car (brand / model / year) or part name at ${origin}/search.
- Browse by part type at ${origin}/categories and by car brand at ${origin}/brands.
- Fitment is listed per product. If unsure whether a part fits a specific car, direct the user to LINE Official Account support instead of guessing.

## Ordering, payment, delivery

- Browsing and cart are open to everyone; checkout requires phone-OTP login/registration at ${origin}/login.
- Payment methods: PromptPay QR, bank transfer, cash on delivery (COD). Details at ${origin}/info.
- Do not present prices, stock, delivery times, or COD eligibility as guaranteed — they can change.

## Order tracking and support

- Guest tracking: ${origin}/orders using a phone number + order number.
- Members can view order history after login.
- For fitment help, missing parts, or refunds, use the LINE Official Account support link on the site.

## Coupons and promotions

- Public coupons: ${origin}/coupons. Flash-sale prices are time-limited and revert automatically.

## Privacy and PDPA

- Privacy policy: ${origin}/privacy. New members give PDPA consent at registration; returning members do not re-consent when logging in.

## Support boundaries

- Never ask users to share OTP codes, passwords, card numbers, or bank/PromptPay credentials.
- Route account-specific order, payment, or refund questions to official AirPlus / Den Air Service support (LINE OA).
- Make clear that prices, stock, campaigns, coupons, and delivery timing can change.
- Treat this catalog as general product information, not professional automotive-repair advice.

## Discovery files

- Markdown sitemap: ${origin}/sitemap.md
- LLM hints: ${origin}/llms.txt
- RSS feed: ${origin}/rss.xml
- XML sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
