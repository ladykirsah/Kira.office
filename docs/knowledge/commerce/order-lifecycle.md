---
type: flow
title: AirPlus order lifecycle (two-axis status)
description: order_status (fulfillment) and payment_status (money) as two independent free-text axes, plus the derived operational status layer the admin UI is built on
tags: [orders, status, lifecycle, admin, airplus]
timestamp: 2026-08-09
status: live
sources: [airplus-order-status-lifecycle.md, kira-financial-part-progress.md, kira-dashboard-notifications-plan.md, airplus-returns-branch-parked.md, kira-subagent-mutated-my-files.md]
---

# AirPlus order lifecycle (two-axis status)

## What it is

The owner chose (2026-07-13) a **two-axis** model instead of one status ladder:

- **`order_status`** — fulfillment, owner-set in admin: ใหม่ (new) → เตรียมจัดส่ง (paid, packing) → กำลังจัดส่ง (shipping) → สำเร็จ (done), with branches ยกเลิก (cancelled) / คืนเงิน (refunded). เตรียมจัดส่ง is a deliberately distinct "paid, packing" state.
- **`payment_status`** — money: รอชำระเงิน (awaiting payment) → ชำระแล้ว (paid) for prepaid, or เก็บเงินปลายทาง (COD). Set at checkout; the owner flips to ชำระแล้ว after confirming the slip.

Both columns are **free text — no DB CHECK constraint**. The admin dropdown (`AirPlusOrders.tsx` `ORDER_STATUSES`) is fulfillment-only; payment values were deliberately removed from it so the two axes cannot contradict each other.

Renderers honor both axes: `/account/orders` statusPill (เตรียมจัดส่ง → warn, คืน → bad); `/orders` `buildSteps` (เตรียมจัดส่ง → shipping step "current" + "กำลังเตรียมจัดส่ง"; ยกเลิก/คืน → red terminal step via `var(--danger)`).

`PATCH /orders/:id` is wired in `apps/api/src/index.ts` calling the pre-existing `updateOrder()` (auto-stamps `ship_time_ms` on the **first** tracking number). Before that wiring, the admin Save button 404'd and the owner could not move an order past ใหม่. Demo-order seed script lives at scratchpad `seed-demo-orders.sql` — idempotent AP-DEMO-01..07, customer resolved by phone 0123456789.

## The derived layer: operationalStatus

`operationalStatus(orderStatus, paymentStatus)` in `@l-shopee/core` maps the two raw axes to **13 operational statuses** — this is what the admin UI actually keys on.

**Invariant: `to_ship` is DERIVED, not a column.** It covers order_status `new` AND `confirmed` AND `packing` once payment clears — anything gating on the raw column misses two of the three. Leaving To ship requires writing `order_status='shipped'`; a drop-off form that only saves carrier/tracking leaves the order in To ship forever and the form never disappears.

**Summary cards** (owner rule, 30 Jul 2026, `apps/admin/src/lib/orderSummaryCards.ts` + tests): every card is exactly one operational status; labels are DERIVED from `operationalStatusLabel` so they cannot drift from the Status column or Filter dropdown; where a card's label equals a tab's label, the card IS that tab. Card counts are **all-time** by design, so clicking one widens the date range — otherwise a card reading 1 could open an empty table under the default Today filter. Open follow-up (PR #92 era): the operational pill shows a generic "Fail" for cancelled; making it say "Cancelled" vs "Expired" is blocked on the one-label-source rule (split "fail" or override only in the badge).

## Building blocks for notifications/dashboards — reuse, don't reinvent

- Order data: `fetchOrders()` from `@/lib/api` → `OrderRow[]`, filter `channel === 'airplus'`.
- Action states = the 4 coloured badges in `operationalStatusBadge` (`apps/admin/src/lib/badges.ts`): `cod_pending`, `verifying`, `to_ship`, `return`; `claim_pending` (mechanic approval) joins these for notification purposes.
- Queue groupings: `ORDER_SUMMARY_CARDS` (`orderSummaryCards.ts`) = Pending (cod_pending+verifying) · To ship · In transit · Refund (return + all claims); tab partition = `ORDER_TAB_STATUSES` (`orderTabs.ts`).
- Counting pattern: `countOf(...statuses)` filters airplus orders by operationalStatus.
- Status-tag colours (shipped in PR #110): red `#dc2626`, amber `#d97706` (COD/BC pending + Paused), blue `#2563eb`, green `#16a34a`, grey `#566071`.

## Failed-delivery status semantics (owner decisions, 2026-07-17)

Designed for the since-dropped Shippop integration, but the semantics stand:

- **จัดส่งไม่สำเร็จ (delivery failed) is STICKY**: it stays จัดส่งไม่สำเร็จ during courier retries (never bounces back to กำลังจัดส่ง). It auto-advances ONLY to สำเร็จ if a later delivery attempt succeeds, or to the return rule if the courier gives up.
- Carrier `return` → automatically ยกเลิก; the refund is NOT automatic — the customer initiates via the claim/refund flow (submits their receivable bank account); the owner transfers and sets คืนเงิน manually.
- With the Flash manual-label launch there is **no carrier webhook**, so statuses are owner-set in admin. A delivery_failed+paid → full-refund flow was later built (PR #93) — see [refunds-and-returns](refunds-and-returns.md); verify current code before extending.

## Cancel/refund stock-restore asymmetry — BY DESIGN, do not "fix"

Owner decision 2026-07-17 ("staff responsibility on this"):

- **Admin path**: `PATCH /orders/:id` (`updateOrder`) sets ยกเลิก/คืนเงิน with a plain UPDATE and does **NOT** restore stock — a returned part may be damaged/unsellable, so staff restock manually per-case via Stock adjust. `updateOrder` carries a comment saying this is intentional. Accepted risk: staff forgetting to adjust means on-hand under-counts.
- **Storefront customer cancel** (un-shipped orders only) **DOES** auto-restore via `applyAdjustment` `refund_return` — un-shipped reservations never left the shelf.

Separate open item: **flash-slot release on cancel** — `campaign_prices.sold_count` is never decremented, and `sales_order_lines` has no `campaign_price_id` to re-derive the slot.

## Testing lesson: make join keys load-bearing in both directions

A mutant `c.name = o.buyer_username` PASSED the original listOrders join test — a real false green, because the fixture used the same string for the customer's name and the order's `buyer_username`. The fixture (`apps/api/src/index.test.ts`) was rebuilt so linked orders use a handle (`somchai99`) that differs from the customer name, and the unlinked order uses a `buyer_username` that exactly matches a customer name — a wrong-column join now fails in both directions. Verified by killing three mutants (INNER JOIN, name-join, dropped column). Reuse the pattern: when testing a join, fixture values must differ across every column a wrong join could confuse. See [conventions](../conventions/index.md) for the wider engineering rules.

## Punch list carried forward from the financial part (as of 31 Jul 2026; some may since be resolved)

1. Shop info → AirPlus has no address or ship-from phone, so the parcel label's sender block is empty — owner data entry, blocks real label printing.
2. Products with no `brand_id` print an em dash on the label.
3. `updateOrder`'s SELECT omits `customer_code` while `OrderRow` types it required → PATCH response ships `undefined` for it.
4. `html2canvas` declared in `apps/admin/package.json` but missing from the lockfile workspace entry — resolves only via jspdf's optionalDependencies.
5. Old admin Sales → AirPlus tab still holds Thai status arrays + a free-text override that can write unclassifiable values.
6. "No self-serve claim button on the storefront" — since RESOLVED by the defect-claim flow (PR #96, see [defect-claims](defect-claims.md)).

**Channel boundary**: Shopee is a SEPARATE channel — `/orders` filters `channel='airplus'`; Shopee lives on `/sales`. Do not "fix" Shopee orders for missing `customerCode`. Shopee import semantics live in [vs-shopee-business-case](vs-shopee-business-case.md).

## References

- `apps/api/src/index.ts` (updateOrder, PATCH /orders/:id)
- `apps/admin/src/lib/orderSummaryCards.ts`, `orderTabs.ts`, `badges.ts`
- `AirPlusOrders.tsx` (sales/AirPlusOrders.tsx)
- Layout standard for /orders/:id (Zone A / Zone B) is in `docs/ORDERS_UX_SPEC.md` §2.1
- Related: [refunds-and-returns](refunds-and-returns.md), [defect-claims](defect-claims.md), [money-model-and-finance](money-model-and-finance.md)
