---
type: guide
title: Back-office knowledge index
description: Products, catalog/taxonomy, barcode & labels, stock full-track, on-site POS, Insight analytics, dashboard, Shopee strategy
tags: [index, back-office]
timestamp: 2026-08-09
status: live
sources: [session-memory corpus, repo]
---

# Back-office

Admin-side domain knowledge for Kira.office: the product catalog, stock tracking, on-site selling, and the analytics/dashboard surfaces on top. Read the invariant files before touching their areas — most of them encode bugs that already happened once.

| Concept | One line |
| --- | --- |
| [products](products.md) | Delete = soft-archive (every list MUST filter it; two deliberate exceptions); Add/Edit saves atomically via one D1 batch with recover-on-existing-ref |
| [product-content-patterns](product-content-patterns.md) | PARKED: per-product NAMING pattern (a scored design already exists in an old session — retrieve, don't re-answer) and the Terms↔description pattern manager (build last) |
| [taxonomy-and-attributes](taxonomy-and-attributes.md) | Categories ⊂ car systems (0064); name_th/name_en on 5 tables (0060) with `name` as untouchable identity; in-use attribute delete = 409 block; per-category warranty_days (0054) |
| [catalog-visibility-and-launch-state](catalog-visibility-and-launch-state.md) | Storefront gate = active AND stock > 0 — price does NOT gate, unpriced lists at ฿0; prod catalog was 6 demo rows, real load = longest-lead owner blocker |
| [barcode-labels](barcode-labels.md) | Label page (PRs #77/#78/#79): owner-LOCKED artwork (Full·Minimal × L/S, exact px = spec), per-label size, proportional-shrink A4 packing; 2 open items |
| [stock-full-track](stock-full-track.md) | on_hand = SUM(quantity_delta) via single-writer DO (blockConcurrencyWhile); holds are negative-delta ledger movements — a bucket, NOT a reservation; /scan 5 modes live; branch `claude/kira-office-tasks-b9b9c5` BLOCKED |
| [onsite-pos](onsite-pos.md) | draft\|quotation\|bill on one row, one id space — fence bill ids on EVERY write/delete; one /sync money path; read-only reprint; PR #81 customer+payment flow; pos/page.tsx traps |
| [airplus-insight](airplus-insight.md) | Shopee-parity analytics (PR #124, migration 0087), super-admin only; day-rotating visitor hash = privacy by construction; NEVER rotate TRACK_SALT |
| [dashboard-shortcuts](dashboard-shortcuts.md) | Order summary frame + manual Shopee stock worklist (PRs #111/#113, migration 0080 shopee_synced_at) |
| [staff-days-off](staff-days-off.md) | วันหยุด on three screens (own / team / a person's profile); เต็มวัน·ครึ่งวัน cost a day, เข้าสาย does not; **only the owner may delete** — deleting gives back a day's wage; เงินเบิกล่วงหน้า designed but PARKED |
| [shopee-integration-strategy](shopee-integration-strategy.md) | PARKED on owner manually setting Shopee SKUs = Kira codes; matcher = exact-match-or-skip, never name-guess; signing/planner/ingest helpers already in repo |

Neighbouring areas: [platform](../platform/index.md) · [operations](../operations/index.md) · [auth](../auth/index.md) · [commerce](../commerce/index.md) · [storefront](../storefront/index.md) · [conventions](../conventions/index.md)
