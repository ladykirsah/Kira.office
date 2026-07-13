# Module — Sales, Finance & Import

The records side: completed sales (on-site + imported), refunds, finance summary, and the CSV bridge
that stands in for the live Shopee API. Math lives in [MODULE_CORE_LOGIC.md](MODULE_CORE_LOGIC.md)
(`finance.ts`, `orders.ts`, `imports.ts`); endpoints in [API_REFERENCE.md](API_REFERENCE.md).

## Files

| File | Role |
| --- | --- |
| `apps/admin/src/app/sales/page.tsx` + `SalesTable.tsx` | On-site sales list, gross profit, refund action. |
| `apps/admin/src/app/orders/page.tsx` | Orders list; **Save** edits `order_status`/`payment_status`/`carrier`/`tracking_no` via `PATCH /orders/:id` (AirPlus-channel only). |
| `apps/admin/src/app/finance/page.tsx` | Finance summary (revenue, VAT, gross profit, refunds). |
| `apps/admin/src/app/import/page.tsx` | CSV import UI — product catalog + Shopee orders, with column mapping. |
| `apps/api/src/index.ts` | `/sales`, `/sales/:id/refund`, `/sales/export.csv`, `/orders`, `PATCH /orders/:id`, `/finance/summary`, `/import/products`, `/import/shopee-orders`. |

## Sales & finance

- **On-site sales** arrive via `/sync` (see [MODULE_POS_AND_SYNC.md](MODULE_POS_AND_SYNC.md)) into
  `onsite_sales` + `onsite_sale_lines`, each line carrying a **cost snapshot** (`unit_cost_satang`,
  `cost_method_used`) and `gross_profit_satang` so history is immutable.
- **Refund** (`POST /sales/:id/refund`) restocks lines through the `StockLedger` DO and writes
  reversing finance records → `{applied, reason?, restockedLines}`.
- **Finance postings** are built by `buildSaleFinanceRecords` / `buildRefundFinanceRecords` and
  stored in `financial_records` (revenue / tax / fee / cost / profit, inputs **and** outputs).
- `/finance/summary` → `{salesCount, revenueSatang, vatSatang, grossProfitSatang, refundCount,
  refundedSatang}`. `/sales/export.csv` is the accountant export.
- **Order fulfilment** (`PATCH /orders/:id`, AirPlus-channel only) wires the previously-unrouted
  `updateOrder()` — the admin **Save** used to 404. It edits `order_status`/`payment_status`/`carrier`/
  `tracking_no` and stamps `ship_time_ms` on the first tracking number (no schema change — existing
  free-text columns). Two-axis lifecycle: `order_status` (fulfilment) `new → preparing (เตรียมจัดส่ง) →
  shipping → done` + cancel/refund; `payment_status` (money) `awaiting → paid` + COD; the admin status
  dropdown is trimmed to fulfilment-only.

## Import (the Shopee bridge)

Until the live Shopee API is enabled (gated — see [SHOPEE_INTEGRATION.md](SHOPEE_INTEGRATION.md)),
data crosses by CSV:

- `POST /import/products` → `{received, valid, invalid, errors[]}` — bulk product create. Uses
  `parseCsv` + `mapRows` (per-row validation; bad rows reported, not fatal).
- `POST /import/shopee-orders` → `{received, imported, duplicates, invalid, errors[]}` — order
  import deduped by `channel + external_order_id` (`dedupeOrders`; `sales_orders` has the matching
  unique index, so re-importing the same export is safe).

Both take `{csv, mapping}` where `mapping` maps source columns to fields, chosen in the import UI.

## Status & next steps

- Built: sales list + refunds, finance summary, CSV product + order import, CSV sales export.
- Next: surface all four cost methods in the finance/pricing UI; richer accountant export format
  (confirm preferred software — [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) #32); replace the CSV order
  bridge with the live Shopee adapter once eligibility is confirmed.
