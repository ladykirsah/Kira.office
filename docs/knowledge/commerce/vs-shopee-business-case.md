---
type: guide
title: vs-Shopee business case & Shopee order money semantics
description: July 2026 actuals — AirPlus ≈4.2× net profit on the same orders; ≈฿268/order fee saved is the cost yardstick; plus the Shopee import's net-vs-gross column trap
tags: [shopee, business-case, fees, profit, import]
timestamp: 2026-08-09
status: convention
sources: [airplus-vs-shopee-business-case.md, stock-full-track-roadmap.md]
---

# vs-Shopee business case & Shopee order money semantics

## July 2026 Shopee actuals (25 orders)

From the owner's July Shopee sheet, cross-checked exactly with session `claude/shopee-commission-analysis-690746`:

| Metric | Value |
|---|---|
| Sales (Buyer Pays) | ฿29,777.00 |
| Shopee fee | ฿6,708.00 (blended 22.53%) |
| Paid to Me | ฿23,069.00 |
| COGS | ฿20,961.91 |
| NET | ฿2,107.10 (7.1% margin) |

Same orders on AirPlus (no fee): NET ฿8,815.10 (29.6%) ≈ **4.2×**. **≈฿268 saved per order = the yardstick** for whether any AirPlus cost is worth it. Worst case ALL-COD (Flash ≈3% = −฿893) → ฿7,922, still 3.8×; PromptPay = ฿0 fee.

Re-pricing provision: 23% (25% for sub-฿150 SKUs — a ~฿2 fixed fee component pushes small-ticket fee% to 24–26%).

Striking orders: the ฿8,985 order `2607071N92RGSF` paid Shopee ฿2,019, owner netted ฿91; order `260704R1JVEYTP` was a −฿10.99 LOSS on Shopee, +฿563 on AirPlus.

Caveats: July point-in-time, small volume; **customer acquisition is the real constraint** (owner's framing). Use to prioritize migrating big-ticket Shopee orders first.

## Shopee order-level import semantics (Sales → Shopee table)

Built in f2d5be4 + fee/import work. **Channel boundary**: Shopee lives on `/sales`; AirPlus on `/orders` ([order-lifecycle](order-lifecycle.md)).

- Order ID + buyer username (ชื่อผู้ใช้ผู้ซื้อ).
- **Sales** = ราคาสินค้าที่ชำระโดยผู้ซื้อ (gross buyer paid for product).
- **Total = seller NET payout** = Sales − total fees (owner: "the amount I get", always < Sales).
- ⚠️ **The export's จำนวนเงินทั้งหมด column is the GROSS buyer total** (product + buyer-paid shipping) — using it for Total was a bug, fixed in 0845378. Never use it for Total.
- Fees = commission + transaction + service ("everything Shopee charges"), stored with the charged % as basis points (`parseFeePct("3.21%")→321`).
- Date = ship time + est-completion (+10 days); status via `shopeeStatusBadge` (TDD'd: Complete=green · Shipped=blue `.pill.info` · Shipping=yellow · Cancelled=gray · Refund=red).
- Migration `0029_shopee_order_fields` added `buyer_username`, `sales_satang`, `fee_bp`, `ship_time_ms` to `sales_orders` (`grand_total_satang` already = payout, `fee_total_satang` = summed fees).
- Importer (2663b8a API + 0282f57 admin) is backward-compatible — a minimal export still imports, new fields null.
- **Profit column exists as STRUCTURE only** (17cdb1d): shows — until SKU linkage lands; when populated, owner's design = the Fees pattern: profit THB (body2) + margin % (subtitle); Profit = Total(net payout) − Kira cost×qty.
- Xlsx upload (458d607): `packages/core/src/xlsx.ts` is a dependency-free .xlsx reader — native DecompressionStream unzip + pure sharedStrings/worksheet parsing + a Shopee transform. It works because Shopee stores EVERY cell as text (no date/number serials, so no SheetJS needed).

Wider Shopee integration strategy (Phase 2, parked on the owner's sample export) lives in [back-office](../back-office/index.md).

## References

- session `claude/shopee-commission-analysis-690746`
- commits f2d5be4, 0845378, 17cdb1d, 2663b8a, 0282f57, 458d607
- migration `0029_shopee_order_fields`; `packages/core/src/xlsx.ts`
- Related: [money-model-and-finance](money-model-and-finance.md)
