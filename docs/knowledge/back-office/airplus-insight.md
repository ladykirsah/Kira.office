---
type: feature
title: AirPlus Insight — Shopee-parity analytics with privacy-by-construction tracking
description: Super-admin analytics (PR #124, migration 0087) with day-rotating visitor hash, Bangkok-anchored windows, profit via orderMoney(); NEVER rotate TRACK_SALT
tags: [insights, analytics, tracking, privacy, super-admin]
timestamp: 2026-08-09
status: live
sources: [airplus-insight-built.md, packages/core/src/insights.ts, apps/api/src/insights.ts, packages/db/migrations/0087_storefront_events.sql]
---

# AirPlus Insight

## What it is

Shopee Business Insights parity for the AirPlus storefront, LIVE on prod since 4 Aug 2026 — PR #124 (squash `193744f`), migration 0087 applied to prod BEFORE the merge. API + admin auto-deployed; the storefront needed a MANUAL deploy because it had no CI job at the time (since fixed by PR #125 — see [operations](../operations/index.md)). 1966 tests green at ship.

Owner's scope decisions: **"all as Shopee"** (full parity including traffic tracking, not money-only) and hero = **"Sale and profit"** (twin heroes, equal weight). Kira's edge over Shopee: real **profit + margin**, because Kira holds cost.

Files: packages/core/src/insights.ts (windows/metrics/source classification), apps/api/src/insights.ts (aggregation), apps/storefront/src/lib/track.ts + trackEvent.ts + app/api/track/route.ts + components/TrackView.tsx (beacon), apps/admin/src/app/insights/ + lib/insightChart.ts.

## Access: SUPER-ADMIN only

Insight is hidden from the admin role for the same reason /sales is — the headline tiles are profit + margin. **If the owner wants admins to see the traffic half, SPLIT the page; don't open this one.** (Roles model: [auth](../auth/index.md).)

## TRACK_SALT — NEVER rotate

`TRACK_SALT` is a secret on the airplus-storefront worker, declared in `.dev.vars.example`. The salt is part of the visitor digest: changing it re-buckets that day's visitors and everyone active counts twice. Unset falls back to a dev constant — it is **not a security control**, it is bucketing continuity.

## Privacy design: day-rotating visitor hash (invariant)

`storefront_events` (migration 0087) stores NO cookie, no localStorage id, no IP, no user-agent, no referrer URL or query string. `visitor_hash = sha256(bangkok-day + ip + ua + salt)`, server-derived: stable for one Bangkok day, meaningless after. That is the **load-bearing decision keeping tracking outside consent-banner territory by construction** (AirPlus has no cookie banner on main; the banner sits on a parked branch — [storefront](../storefront/index.md)).

Known, stated cost (printed on the tile): multi-day visitor counts are **sums of daily uniques**, not deduplicated people; single-day figures are exact.

**Deliberate omissions — do not "fix" without an owner decision:**

1. **No order→traffic-source attribution** — linking a purchase to a browsing trail is exactly what the day-rotating hash refuses. The source table reports traffic only, and says so.
2. **No อัตราการคลิก (CTR)** — needs card-impression tracking that isn't recorded; product conversion (units ÷ views) is shown instead. Adding an `impression` kind would need a migration because the `kind` CHECK is a **closed set of 5**.

## Metric invariants

- **All window boundaries are Bangkok-anchored.** Workers run UTC, so `setHours(0)` there = 07:00 Bangkok and would drop pre-breakfast orders. Comparisons are like-for-like: an 18 h-old day vs the first 18 h of yesterday; month-to-date clamped.
- **Profit ALWAYS goes through `orderMoney()`, never a SQL formula** (money model: [commerce](../commerce/index.md)). An order with no cost snapshot counts as sales but NOT profit, and the excluded count is surfaced.
- `storefront_events` is in `BACKUP_TABLES` (irreplaceable history) and is the one table that grows with traffic — if the daily dump gets heavy, add a **retention window on the table**, don't drop it from the backup.

## Verification-caught bug patterns (keep as review checklist)

1. **sendBeacon Referer is your own page.** On a beacon POST the Referer header is OUR OWN page, so header-based classification labelled every arrival `internal` and left the traffic-source table permanently empty. The visitor's true origin must travel in the request **body** as `document.referrer`.
2. **Same-format chart series share one scale.** Two independently scaled series made ฿420 profit visually touch ฿1,350 sales — the chart claimed the shop kept everything. Rule: same-format metrics (baht vs baht) share one scale; mixed units (baht vs headcount) may scale independently.

Both were found only by live browser verification against prod — build-time tests missed them.

## References

- [dashboard-shortcuts](dashboard-shortcuts.md) — the other admin surfacing of order/traffic state
- Storefront beacon internals + deploy: [storefront](../storefront/index.md), [operations](../operations/index.md)
