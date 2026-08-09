---
type: plan
title: Product content patterns — naming pattern and Terms↔description (both parked)
description: Two deferred per-product content generators — a NAMING pattern for products.name and a Terms pattern manager generating products.description
tags: [products, naming, terms, description, parked]
timestamp: 2026-08-09
status: parked
sources: [product-naming-pattern-feature.md, terms-description-pattern-feature.md, packages/core/src/terms.ts, apps/admin/src/lib/productLabel.ts]
---

# Product content patterns (parked)

Two sibling features the owner wants tackled together, both deferred. They shape the two big text fields on a product: `products.name` (naming pattern) and `products.description` (Terms pattern). Distinct from the numerology BRAND naming (see [storefront](../storefront/index.md) business facts).

## Naming pattern (not yet scoped — but a design already exists)

Flagged by the owner 2026-07-04: a per-product naming pattern for how `products.name` is composed — part type · fitment · code · brand, auto-composed with a hand-edit override.

Groundwork already shipped: the display-time label composes "item · brand" via `productDisplayName` (apps/admin/src/lib/productLabel.ts) at POS cart-line creation — it flows to cart, printed bill, stored description, customer history, and reprint. A true naming pattern would shape the **stored** `products.name` itself.

**CRITICAL — do NOT re-answer from scratch.** A concrete pattern discussion happened 2026-07-22: the owner asked "suggest me a naming pattern that will help catching good score on all OE system", working from ตู้แอร์โตโยต้า (Toyota evaporator); the reply **scored candidate titles numerically** (e.g. "B — 93"). That scored comparison is the design the owner remembers and prefers. It lives in session `local_6b8af3b1-f1d1-4fed-9bb9-a569288b8115`, title "🌟 Fix kira-office Durable Object deploy blocker", worktree `brave-dijkstra-eab381`, ~3134 messages with the exchange far from the end — **search transcripts for "good score on all OE system"** rather than paging `list_events`. On 2026-07-23 an assistant re-answered from scratch and the owner had to point back at the earlier, better discussion — retrieve it first.

## Terms↔description (build LAST)

Sequenced after Stock and the Products UI-consistency sweep. `products.description` **is** the product's Terms / online-listing text — the long Thai spec + warranty block (e.g. the ✅ Isuzu / ✅ Chevy + Vinn / Cool-Gear example), not a short spec.

Locked design (owner, July 2026):

- The Terms page becomes a **pattern manager** — multiple named patterns in `terms_patterns` (already in schema, currently unwired; today's page is a single KV template). Each pattern = a `{{placeholder}}` template rendered by `renderTerms` in packages/core/src/terms.ts **plus** a match rule (part type/name).
- Product edit stays the single freeform store (`products.description`, surfaced + wipe-fixed in commit `b2e5b0c`). A product gets its pattern by auto-match on part type/name, with a pattern-picker dropdown to override.
- **[Default]** button = render the matched/picked pattern with product info (name, code, fitments, brand variants + codes, shop info, warranty). **[Clear]** = empty the field. Text stays hand-editable after generation.
- `product_terms` (the versioned/approval table) is NOT needed for this single-field model → cut candidate.

Phases: (1) pattern manager, (2) [Default]/[Clear] + auto-match + picker + variable injection, (3) rich injection (multi-line fitments, multi-brand variant codes).

## References

- [products](products.md) — the save path these fields ride on
- Warranty data injected by Terms comes from `product_types.warranty_days`: [taxonomy-and-attributes](taxonomy-and-attributes.md)
- Repo doc: docs/PRODUCT_TERMS_PATTERNS.md
