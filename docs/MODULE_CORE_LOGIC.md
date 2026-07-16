# Module — Core Domain Logic (`packages/core`)

The money- and stock-critical engine. **Pure TypeScript, no I/O, no Cloudflare or React deps** — it
operates on plain inputs and returns plain results, so every rule is unit-testable without a DB,
browser, or Shopee. `apps/api` and `apps/admin` import it; it imports nothing of theirs. **Change it
test-first** (red→green) per [AGENTS.md](../AGENTS.md).

Authoritative formula reference: [PRICING_AND_FINANCE.md](PRICING_AND_FINANCE.md). All amounts here
are **THB decimals**; satang conversion happens at the persistence boundary (`money.ts`).

## Files & exports

### `money.ts` — currency boundary
`round2(v)` (half-away-from-zero to 2 dp), `toSatang(thb)` = `Math.round(thb*100)`, `fromSatang(s)`.
The only place THB↔satang conversion should live.

### `tax.ts` — VAT split
`computeTax({netOfDiscount, vatRate, priceIncludesVat, isTaxable})` → `{taxAmount, salesExTax,
buyerPrice}`. Three branches, each derived so **`salesExTax + taxAmount === buyerPrice`** (finance
postings tie out exactly):
- **non-taxable / 0 rate:** tax 0; salesExTax = buyerPrice = net.
- **VAT-inclusive:** buyerPrice = net; tax = `net − net/(1+rate)`; salesExTax = buyerPrice − tax.
- **VAT-exclusive:** salesExTax = net; tax = `net*rate`; buyerPrice = net + tax.

### `pricing.ts` — profit & price suggestion
- `computeSaleProfit(line)` → `SaleProfit`. **Profit = salesExTax − marketplaceFee − landedCost.**
  On-site has no marketplace fee. Online fee = `feeBase × (commission+transaction+service) + fixed`,
  where `feeBase` is `buyer_price` (default) or `ex_tax`. An online line with no `fees` is fee-free.
- `summarizeSale(lines)` → basket/order totals. **Round-per-line-then-sum** so totals equal the sum
  of the per-line numbers on a receipt (can differ ≤1 satang from rounding the raw aggregate).
- `suggestPriceForTargetMargin(input)` → the unit price achieving a target gross margin on ex-VAT
  revenue, inverting VAT + scaling online fees. **Throws** when the margin is infeasible for the
  cost/fees.

### `cost.ts` — cost methods (all four)
`CostMethod = moving_average | latest | manual | fifo`. `movingAverageUnitCost(layers)`,
`latestUnitCost(layers)`, `fifoConsume(layers, qty)` → `{unitCostTotal, remainingLayers}`,
`receiveStock(layers, received)`, and `resolveUnitCost(input)` which dispatches by method. Cost is
**snapshotted onto each sale line** so history never moves when the method changes.

### `stock.ts` — **deleted** (was never wired to anything)
There is no stock module in core. `stock.ts` held `availableFromLedger` / `applyMovement` /
`applyMovements` / `applyMovementsSafe` and a `StockState` reservation trio (`reserve` / `release` /
`fulfillReservation`). **Nothing imported any of it** except its own `stock.test.ts`, so it was
removed rather than left to read as a foundation.

It was never the basis for `/sync` or `/stock/adjust`: both implement their own logic in raw SQL
inside `apps/api/src/index.ts`, which never called into core. **That inline SQL is the only stock
implementation** — read it there, not here.

The reservation trio in particular was a sketch, not a foundation: it modelled holds as an in-memory
`{onHand, reserved}` scalar pair, but **no `reserved` column exists in D1** (the
`inventory_snapshots` table that would have stored it was dropped in migration `0024`), and nothing
persisted a reservation. A scalar `reserved` also cannot express *who* holds stock, *for which
customer*, or a partial return. Anyone building holds starts from the ledger, not from that shape.

The one rule that survives, honoured by the real code: on-hand is **always derived from deltas**
(`SUM(quantity_delta)` over `stock_ledger_entries`), never overwritten.

### `sync.ts` — idempotency
`partitionByClientUuid(items)` → `{unique, duplicates}`. Backs the offline-sale dedupe so a re-flushed
sale is never double-counted (D1's unique index on `onsite_sales.client_uuid` is the backstop).

### `finance.ts` — double-entry-ish postings
`buildSaleFinanceRecords(...)` and `buildRefundFinanceRecords(...)` produce `FinanceRecordDraft[]`
(revenue / tax / fee / cost / profit) written to `financial_records`. Stores **both inputs and
outputs** so historical records are immutable when rules change later.

### `orders.ts` — CSV + order dedupe
`parseCsv(text)` (quote-aware), `orderKey(order)` = `channel + external_order_id`,
`dedupeOrders(orders)` → unique vs duplicate (no double import; `sales_orders` has a matching unique
index).

### `imports.ts` — row mapping
`mapRows(rows, mapping, …)` → `{ok, errors: RowError[]}`: maps CSV columns to fields and validates,
surfacing per-row reasons rather than failing the whole import.

### `shopee.ts` — stock push (gated)
`computeShopeeStockUpdates(links, localStock)` → the per-listing/model stock deltas to push when the
live Shopee API is switched on. Kept here so it is testable without the API.

### `terms.ts` — Thai T&C templates
`renderTerms(template, vars)`, `extractPlaceholders(template)`, `findMissingPlaceholders(template,
vars)` — the substitution engine behind the (not-yet-built) per-product generate+approve flow.

## Testing

Each file has a sibling `*.test.ts` (Vitest, node env). Critical paths (money, tax, cost, sync) must
cover happy path **plus** failure/edge values (zero, negative, infeasible margin, duplicate uuid).
These run in the repo-wide `npm test`. Note that **stock has no coverage here** — it lives in
`apps/api/src/index.test.ts`, against the raw SQL.
