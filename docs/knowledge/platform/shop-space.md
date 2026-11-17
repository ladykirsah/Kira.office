---
type: feature
title: Each shop's own space — one database per shop, picked by the app's address
description: Plan 10.3 — TeamPit sold to other shops; each shop has its own D1 database, settings prefix and stock writer; the request's Origin picks the shop; Den Air untouched; new shops made with scripts/new-shop.mjs
tags: [platform, multi-shop, tenancy, d1, durable-objects, kv]
timestamp: 2026-11-17
status: built (server + ข้อมูลร้าน cards; a real second shop waits for the first sale)
sources: [owner messages 17 Nov 2026 (pick A), plan 10.3, Cloudflare D1 limits + SaaS data-isolation docs, Square / Loyverse / FlowAccount help centres]
---

# Each shop's own space

Plan 10.3 (owner, 17 Nov 2026, pick **A**: each shop has its own web address). Needed before
TeamPit is sold to other car A/C shops. Global practice checked first: Cloudflare builds D1 for
per-tenant databases (about 5,000 per Worker, 10 GB each); POS apps link a device or an address to
the business and staff type their own PIN (Square, Loyverse; Shopify / Slack give each customer an
address); FlowAccount lets one login hold several companies (not built here).

## The model (`apps/api/src/shops.ts`)

- **One database per shop** — separate boxes, not a shop label on every row, so a forgotten filter
  can never show one shop's records in another. Each shop's running numbers (bills, jobs, TI/CN)
  start at 0001 on their own, as each seller's tax papers must.
- **Den Air is the shop that was always here**: binding `DB`, settings keys unprefixed, stock writer
  `"default"` (the AirPlus storefront calls it by that name, cross-Worker), ข้อมูลร้าน cards `denair` +
  `airplus`. Nothing about it moved; plan 10.3 needed no live database change.
- **Any other shop** comes from the `SHOPS` var (JSON list of `{id, name, db, origins, ownerEmails}`):
  its own D1 binding, settings under `shops/<id>/` (a prefixing KV wrapper), stock writer
  `shop:<id>`, backups under `shops/<id>/backups/`, one ข้อมูลร้าน card — profile id `denair`, which
  in the code means "the counter" (every shop has one). Owner lock from its own `ownerEmails`. A
  broken or clashing entry is left out and logged; Den Air keeps working.
- **The request's `Origin` picks the shop** (`shopForOrigin`); no Origin or one nobody claims → Den
  Air, as before. A sign-in only exists in its own shop's database, so naming another shop's
  address gains nothing. The 6-wrong-PIN brake, sessions and the owner lock are per shop because
  they live in the shop's database.
- **The Worker swaps `env` at the top of `fetch`** (`shopEnv`): from there on every route uses the
  shop's `DB`, `KV`, owner emails and `SHOP`. The StockLedger finds its shop from `ctx.id.name`. The
  nightly cron runs per shop (expiring AirPlus orders only where the shop has the website).
- **Guard:** `shopGuard.test.ts` fails the build if `fetch` uses the Worker's own settings for more
  than picking the shop, if the StockLedger touches `this.env.DB/KV`, if anything opens
  `idFromName("default")` directly, or if the cron skips `shopEnv`. `shopSpace.test.ts` runs two
  real-schema shops side by side.

## The app

`GET /shop` → `{id, name, profiles}`. ข้อมูลร้าน shows only the shop's own cards (`shopCards`), the
counter card named by the shop until a name is saved; a card the shop doesn't have says ไม่มีร้านนี้.
Everything else in the app is unchanged — for a new shop, the AirPlus menus (ออเดอร์ AirPlus,
การตลาด AirPlus, AirPlus prices and customers) still show, empty, and the counter card's placeholder
logo reads "DEN"; hiding / renaming them comes with the design stage.

## Making a new shop

`node scripts/new-shop.mjs --id … --name … --origin … --owner-email …` — `--practice` runs every
step on the local copy (`wrangler.practice.jsonc`); without it the steps are only printed, because
each touches Cloudflare and runs only with the owner's yes: `wrangler d1 create teampit-shop-<id>`, add
the binding + `SHOPS` entry to `wrangler.jsonc`, apply migrations (standard lists come with them),
the owner account (email + a temporary password, shown once; they add their PIN), the shop's name
on ข้อมูลร้าน, the app's web address (DNS — ask the owner first), deploy.

## Practice copy

`wrangler.practice.jsonc` = Den Air (same local data) + `practice2` (`DB_PRACTICE2`, app on
http://localhost:8082). Launch configs "api (2 shops)" and "TeamPit shop 2".

## Not in 10.3

Sign-up page and subscription plans; one person in two shops (FlowAccount-style switch); AirPlus
selling parts to other shops; a Formula L view across shops; a real second shop. **When the second
real shop arrives**, every database change must run on every shop's database — move migrations
into the deploy then (ask the owner first).
