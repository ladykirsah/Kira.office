---
type: feature
title: SEO & agent-discovery surfaces
description: PDP structured data, Thai keyword slugs, sitemap/robots, LocalBusiness JSON-LD, GSC, plus /llms.txt-style agent surfaces — and the remaining owner levers
tags: [storefront, seo, structured-data, sitemap, slugs, llms-txt, rss, agents, thai]
timestamp: 2026-08-09
status: live
sources: [airplus-seo-discoverability-built.md, airplus-agent-discovery.md]
---

# SEO & agent-discovery surfaces

## Why

Competitor pataraair.com ranks top-5 on Thai keywords via keyword/schema/domain-age despite bad UX. The SEO build (steps 1–7) exists to beat it on the same levers.

## SEO steps 1–7 (all deployed to prod as of 2026-07-19, via PR #24 on `claude/airplus-publication-plan-08e4c7`)

1. **PDP structured data** — `lib/seo.ts`: `productSeoTitle`, `productMetaDescription`, `productJsonLd` (Product+Offer+Brand), `breadcrumbJsonLd`, `serializeJsonLd` (XSS-safe); `metadataBase` in layout.
2. **Keyword slugs** — `/products/<thai-slug>--<id>`; slug built from name+brand+fitmentShort keeping Thai **including `\p{M}` combining marks** (without it Thai tone marks get stripped — same trap as affiliate slugs, see [affiliate-tools](affiliate-tools.md)); `extractProductId` splits on the FIRST `--` (handles UUIDs and `prod-demo`); 308 redirect bare/stale → canonical.
3. **Sitemap + robots** — `db.sitemapProducts` (uncapped, in-stock only, `<lastmod>`); robots.txt route with a `Sitemap:` directive (verified Cloudflare does NOT override it).
4. **/faq** — the owner-reviewed 34-question rewrite with FAQPage schema, PR #25 + migration `0056_air_filter_type`; full detail in [faq](faq.md).
5. **LocalBusiness JSON-LD** — `lib/business.ts`: AutoPartsStore; name AirPlus, legalName Den Air Service, +66639261445, Prasat/Surin 32140, 09:00–17:00. **Opening DAYS were ASSUMED all week — still unconfirmed, flagged in business.ts** (also noted in [business-and-launch](business-and-launch.md)); `sameAs` → LINE OA.
6. **Core Web Vitals** — measured healthy: CLS 0, ~30KB, PDP FCP 1.2s. Only lever left is TTFB (home 1.3s / PDP 0.95s, caused by force-dynamic + D1); the fix (short edge-cache) was DEFERRED.
7. **Google Search Console** — owner verified the airplusauto.com **Domain property** + submitted the sitemap. A Domain property needs the FULL sitemap URL (`https://airplusauto.com/sitemap.xml`).

## Remaining levers are owner content/authority, not code

- Step 8: Google Business Profile — verification was in flight (≤5 days) at the time.
- Step 9: **real catalog = the biggest remaining lever** — keywords live in product names, and prod still showed 6 demo products including a skincare cream (the standing "demo catalog is customer-visible" blocker).
- Step 10: backlinks — link airplusauto.com from LINE OA / Facebook / Shopee; optional SEM.

## Agent/crawler discovery surfaces

Built 2026-07-13, modeled on gogocash.co's llms.txt pattern. Next route handlers (dot-named folders) under `apps/storefront/src/app/`, each `export const dynamic = "force-dynamic"`:

- `/llms.txt` — operator hints
- `/sitemap.md` — human markdown index
- `/skills.md` — agent task guidance + support boundaries (YAML frontmatter)
- `/rss.xml` — RSS 2.0 feed of new-arrival products (can switch to articles when the SEO/articles phase lands)
- `/sitemap.xml` — core pages + product URLs

Design decisions NOT to regress:

1. **Origin derived per request** via `new URL(req.url).origin` — never a hardcoded domain, so the files self-reference whatever host serves them (staging vs prod).
2. **Shared logic in `src/lib/discovery.ts`**: `escapeXml()` (product names contain `/` and `&`) and `CORE_PAGES` = the ONLY public routes advertised. A test enforces CORE_PAGES never contains `/account`, `/checkout`, or `/cart` — discovery must never point bots at authed/transient pages.
3. **Fail soft**: rss.xml/sitemap.xml read D1 via `listCatalog(db,{limit})` newest-first and return an empty-but-valid feed if D1 is unavailable.

TDD'd in `discovery.test.ts` (6 tests). Caveat carried from the source memory: these were written pre-go-live (storefront went to prod 2026-07-19) — the route files exist in the repo today, but verify the deployed behavior before asserting they are live.

## References

- PR #24, PR #25, migration `0056_air_filter_type`
- `apps/storefront/src/lib/seo.ts`, `src/lib/business.ts`, `src/lib/discovery.ts`, `discovery.test.ts`
- Route folders: `src/app/llms.txt/`, `sitemap.md/`, `skills.md/`, `rss.xml/`, `sitemap.xml/`, `robots.txt/`
