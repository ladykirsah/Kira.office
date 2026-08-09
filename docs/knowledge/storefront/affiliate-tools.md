---
type: feature
title: Affiliate categories & /tools page
description: Affiliate item categories, the /tools shelf page (design B), real-click ranking, Thai slug trap, and the unfiled-cards empty state
tags: [storefront, affiliate, tools, categories, slugs, thai]
timestamp: 2026-08-09
status: live
sources: [affiliate-categories-shipped.md]
---

# Affiliate categories & /tools page

## What shipped (prod, 2026-07-29 — PRs #83/#84, migration 0067)

Migration 0067 was applied to prod BEFORE the merge, per the repo's standing migrations-before-merge rule (see [operations](../operations/index.md)).

- **Schema**: `affiliate_categories` table + `affiliate_items.category_id` / `.pinned`.
- **Admin**: categories are created from the Add-an-item form (dropdown + name + Create); pinning happens on the list row only. The old admin "Sold" field was never sales data — it was `sort_order` and is gone (new cards auto-file after the last via `nextSortOrder`); the table column was renamed "Order".
- **Storefront cards** show the real outbound click count `คนกดดูแล้ว N ครั้ง` ("N people viewed"), hidden below 10 — `apps/storefront/src/lib/affiliateInterest.ts`.
- **/tools** = design B of the three the owner reviewed: chip bar (`router.replace`, never push — the [navigation](navigation-and-header.md) filter rule) + one shelf per category ordered by REAL clicks, exactly 2 rows (5×2 desktop / 4×2 tablet / swipe rail on phone), remainder at `/tools/[slug]`.

## Invariants & traps

- **Thai slug trap**: slugs keep Thai — `\p{M}` must be in the slug character class or Thai tone marks are stripped (same trap as product slugs, see [seo-and-agent-discovery](seo-and-agent-discovery.md)).
- **Owner rules, locked**: unfiled cards are HIDDEN from the shop; the HOME affiliate shelf was deliberately left alone (still pinned-first, unfiled included) — only /tools filters by category.
- The page is force-dynamic; there is no cache to bust.

## Open item (point-in-time 2026-07-29 — owner may have filed them since)

All 19 prod affiliate cards had no category, so airplusauto.com/tools rendered its empty state. It fills the moment the owner assigns categories in admin (force-dynamic). Unfiled rows are flagged amber in admin: "ยังไม่จัดหมวด · ไม่แสดงบนหน้าร้าน" (not categorized · not shown on the storefront).

## References

- PR #83, PR #84, migration 0067
- `apps/storefront/src/lib/affiliateInterest.ts`, `src/lib/toolGroups.ts`, `src/lib/toolSlug.ts`, `components/ToolChips.tsx`, `AffiliateShelf.tsx`
