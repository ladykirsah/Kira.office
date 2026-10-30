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

## Cancelling an order (owner decisions, 2026-10-30) — supersedes the old "asymmetry" note

There is ONE cancel door: `POST /orders/:id/cancel` → `StockLedger.cancelOrder` → `cancelOrderInDb`
(`apps/api/src/index.ts`; rules in `packages/core/src/orderCancel.ts`, tested).

- **Who:** the owner or an admin (`canCancelOrderRole`); a mechanic gets 403.
- **When:** only before the parcel is sent (`new` / `confirmed` / `packing`). A slip still in
  `verifying` must be checked first. Sent, cancelled and expired orders are refused with 409.
- **Reason required:** `customer_request` / `out_of_stock` / `unreachable` (ติดต่อลูกค้าไม่ได้,
  added 2026-10-30, migration 0092) / `other` (+ an optional note), stored in
  `sales_orders.cancel_reason` (migration 0091) and written on the timeline.
- **Credit:** `customer_request` costs the customer a point, paid or not; every other reason —
  `unreachable` included (owner, 2026-10-30) — costs nothing. Older cancels with no reason keep the
  old rule (pending / cod_denied → −1).
- **The customer sees the reason:** the cancel step on the storefront's order-tracking page reads
  "เหตุผล: <reason>" (then the refund's progress if money is owed). `cancelStepDetail` in
  `apps/storefront/src/lib/cancelReason.ts`; the lookup route returns `cancelReason`.
- **A refund never expires** (owner, 2026-10-30): the customer can come back any time, and LINE OA
  is the only channel (they give the order number, username or phone; the shop finds the order with
  the tools it already has). `classifyRefundAction` has no clock any more.
- **One batch:** status, stock back, coupon back and the timeline step. Every statement after the
  guarded UPDATE is conditional on `cancelled_at` equalling this cancel's own timestamp, so a
  drop-off that wins the race leaves nothing half-done.
- **Stock back** = whatever the order's own `sales_order` ledger rows still net to (checkout's
  deduction is best-effort; no deduction → nothing restocked; running it twice gives back nothing).
  The rows are `refund_return` with reason `order_cancelled`.
- **Coupon back:** its `coupon_redemptions` row is deleted, so the customer can use it again. The
  order keeps its own discount figures.
- **Paid → refund:** `classifyRefundAction` now also covers `cancelled` + paid, so the same refund job
  as a bounced parcel appears. The customer sends their bank account on the storefront (the
  refund-bank route accepts it), then `recordRefund` pays the full amount. It does **not** restock
  a second time, and the timeline note reads "คืนเงินแล้ว (ยกเลิก)".
- **`PATCH /orders/:id` can no longer set `cancelled`** (409). A bare status write undid nothing.
- **Expired orders** (48h unpaid) now give their stock back too, reason `order_expired`. Before this
  every expired order quietly kept its units off the shelf.
- **Shopee list:** cancel and expiry restocks are ignored (`SHOPEE_COUNTED`), since the `online_sale`
  they reverse never reached that list either.
- **Storefront:**
  - A cancelled, unpaid order still takes a slip until its own payment deadline (`paymentDeadline` /
    `slipAfterCancel`). That slip is checked and then refunded in full.
  - After the deadline the slip route refuses, and the page sends the customer to LINE OA.
- **Still to do:**
  - **Flash-sale `sold_count`:** not released on cancel (owner: later). `sales_order_lines` doesn't
    record which `campaign_prices` row priced a line.
  - **Customer COD-refused cancel (`/api/orders/cancel`):** still writes `cancelled` directly, with no
    restock or coupon release.
  - **Website deploys:** the storefront parts go live only once its deploys are unblocked (Next 15).
- **Back-office app (Expo, drawings boards 5–6, built 2026-10-30):**
  - `GET /orders/:id` returns `order.cancelReason` + `order.cancelledAt`.
  - Rules live in `apps/mobile/src/lib/orderPage.ts`: `cancelButton`, `cancelInfo`, `refundOnCancel`,
    `statusWord`. A slip that arrives after the cancel (`cancelled` + `verifying`) is still the pay
    job. Screens are in `ui/orders/Cancel.tsx`.
  - "ยกเลิกออเดอร์" shows at the foot of the page for the owner and admins before sending. On a
    slip still waiting it only shows "ตรวจสลิปก่อน แล้วค่อยยกเลิก".
  - Cancelled orders with nothing owed show a "ยกเลิกแล้ว" card: time, reason, stock back, coupon.
    A storefront discount *is* its coupon, so no discount reads "ไม่ได้ใช้คูปอง".

The old 2026-07-17 rule ("a returned part may be damaged, staff restock by hand") still holds for
**bounced parcels and claims**. It never applied to an unsent order, whose goods never left the shelf.

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
