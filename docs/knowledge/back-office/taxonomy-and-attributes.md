---
type: invariant
title: Taxonomy — hierarchy, bilingual names, attribute delete, per-category warranty
description: Product categories ⊂ car systems (0064); name_th/name_en on 5 tables (0060) with `name` as untouchable identity; in-use attribute delete = 409 block; warranty_days per category (0054)
tags: [taxonomy, attributes, bilingual, warranty, car-systems, migrations]
timestamp: 2026-08-09
status: live
sources: [kira-taxonomy-hierarchy.md, taxonomy-bilingual-names.md, attribute-delete-warn-then-allow.md, airplus-returns-pages-and-warranty.md, packages/db/migrations]
---

# Taxonomy — hierarchy, bilingual names, attribute delete, warranty

## Hierarchy: product categories are a subset of car systems (migration 0064) — all 3 phases live since 2026-07-26

Owner model: each product category (`product_types`) belongs to one car system (`usage_categories`), managed like the car-fitment page; the English name is the permanent identity/anchor; adding happens only in the top "Add new" section; existing categories were backfilled to A/C.

`0064_product_type_car_system.sql` adds a plain **nullable** `product_types.usage_id` — app-enforced like other taxonomy links (D1 does not enforce declared FKs).

- **Phase 1 (admin):** `listAttributes` returns `usageId` on product_types; `POST /attributes/:kind` stores it; `PUT /product-types/:id/car-system` reassigns. AttributeManager.tsx replaced flat cards with a CarSystemPanel master-detail; remove-system is disabled while a system has categories (orphan guard — **the server-side guard is still a TODO**); an "Unassigned" bucket catches stray `usageId`.
- **Phase 2 (commit `542e2ea`, no migration):** Add-product "Smart both-directions" cascade in apps/admin/src/lib/categoryCascade.ts (pure, 18 tests): `categoryNamesForSystem` (unknown/empty system → ALL options, never a mystery-empty list), `systemForCategory`, `systemChangePatch` (clears a Part-name belonging to a different KNOWN system; keeps free-typed), `categoryPickPatch` (picking a part auto-fills/switches its system). PartDetails.tsx is shared by Add + Edit. Backend `resolveAttribute`/`addAttribute` take optional `{usageId}` so a NEW category inherits the selected system while an EXISTING one keeps its own (Settings owns it).
- **Phase 3 (commit `1c6c2b5`, no migration):** storefront /categories groups by car system via apps/storefront/src/lib/groupBySystem.ts (5 tests, first-seen order + trailing null bucket); `listProductTypes` joins usage_categories. Built at the owner's insistence despite advice it was unnecessary (100% of the catalog is A/C today) — scales automatically as other systems gain categories.

## Bilingual names (migration 0060, PR #50) — `name` is IDENTITY

`brands`, `car_brands`, `car_models`, `usage_categories`, `product_types` all carry nullable `name_th`/`name_en` (prod + deployed 2026-07-22, commit `d9af9e4`). Hard rules:

1. **`name` is identity, not decoration.** `product_fitments.car_brand` references `car_brands.name` as free TEXT (not id), and every table has a UNIQUE index on `name` — rewriting `name` silently orphans fitments. The admin edits ONLY `name_th`/`name_en` via `PATCH /attributes/:kind/:id`.
2. `displayNames()` in packages/core returns `en: null` when it would repeat the headline — a row named in one language shows that name ONCE (Hino renders one line; โตโยต้า/Toyota renders two).
3. The two hardcoded label maps in apps/storefront/src/lib/labels.ts were **deleted** — add translations in Kira.office, never in code. `CAR_BRAND_LOGO` survives (asset path, not owner-editable copy).
4. Backfill is by script, not guessing: Thai is U+0E00–U+0E7F, SQLite `GLOB '*[฀-๿]*'` decides which column an existing name belongs to, mirroring `splitLegacyName()` — keep the two in step.

Origin insight worth keeping: the owner's "make the two cards the same design" request was a **DATA** gap (names outside the hardcoded maps), never a design gap — check the data before redesigning a component.

## In-use attribute delete = hard BLOCK (409), no force

Deleting a managed attribute (brand/type/usage/car-model/car-brand) that products/fitments still reference used to run a bare DELETE, orphaning `products.brand_id/type_id/usage_id` (id-referenced) or `product_fitments.car_brand/car_model` (name-referenced) — D1 does NOT enforce declared FKs, so lists then render blank cells.

Shipped behaviour (main, deployed 2026-07-26): DELETE routes refuse with **409 "still used by N product(s)/fitment(s)"**; the admin tells the owner to reassign/remove first; **no force override — don't reintroduce warn-then-allow.**

History (why it ended this way): the owner initially picked warn-then-allow (PR #65 built it with force + ConfirmDialog), but PR #69 had ALREADY merged block-behaviour for brand/type/system (`countProductsUsingAttribute`), leaving car_brands/car_models unguarded. Shown the conflict, the owner chose the hybrid — keep #69's block, add the missing guard. #65 was CLOSED; PR #72 shipped `countFitmentsUsingAttribute` (car_models scoped by brand+model, car_brands by name) guarding `/car-fitment/models/:id`, `/car-fitment/brands/:id`, and the car kinds of `/attributes/:kind/:id`. Two count functions exist: `countProductsUsingAttribute` (by id) and `countFitmentsUsingAttribute` (by name). (The owner may later switch to warn-and-allow — that would be a deliberate decision, not a default.)

## Per-category warranty (`product_types.warranty_days`, migration 0054)

`0054_product_type_warranty.sql` adds `product_types.warranty_days` integer **nullable** — a category with none set shows NO warranty row on the PDP, never "0 วัน".

- Storefront: `getProduct`/CATALOG_SELECT return `warrantyDays`; the PDP shows it only when set.
- API: `normalizeWarrantyDays` (positive int or null; 0/blank/negative/junk → null), `listTypeWarranties`, `setTypeWarranty`; routes `GET /product-types/warranty` + `PUT /product-types/:id/warranty`.
- Admin: Settings → Warranty page (settings/warranty/page.tsx) + Sidebar link; the วัน (days) input saves on blur.

Caveats carried from build time: the admin/API half was built + typechecked but **not visually verified** at write time (it needed 0054 on prod + API/admin redeploy). The feared migration-number collision with other branches' 0053/0054 resolved itself — the file landed on main as `0054_product_type_warranty.sql` (verified in packages/db/migrations 2026-08-09).

## References

- [products](products.md) — attribute references live on product rows
- [catalog-visibility-and-launch-state](catalog-visibility-and-launch-state.md) — what the storefront actually shows
- Migration discipline: [operations](../operations/index.md)
