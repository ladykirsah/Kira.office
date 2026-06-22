# @l-shopee/core

Pure TypeScript domain logic for the L Shopee back office — **no I/O, no framework, no Cloudflare
dependencies**. Every function is deterministic and unit-tested (Vitest), so the Workers, the
stock-ledger Durable Object, and the D1 layer can be thin glue over tested logic. Money math here is
in **THB decimals**; the persistence boundary converts to/from **integer satang**.

```bash
npm test            # from repo root — runs the Vitest suite
npm run typecheck
```

## API

### Money (`money.ts`)
- `round2(value)` — round THB to 2 dp, **half away from zero** (negatives symmetric).
- `toSatang(thb)` / `fromSatang(satang)` — THB ↔ integer minor units for D1 (no float drift).

### Tax (`tax.ts`)
- `computeTax({ netOfDiscount, vatRate, priceIncludesVat, isTaxable? })` →
  `{ taxAmount, salesExTax, buyerPrice }`. Handles per-product VAT inclusive vs exclusive.

### Pricing (`pricing.ts`)
- `computeSaleProfit(line)` → `SaleProfit`. On-site = price − discount − tax − cost; online also
  subtracts marketplace fees (`fees.feeBase` = `buyer_price` default | `ex_tax`).
- `summarizeSale(lines[])` → `SaleSummary` — basket/order totals (discount, tax, fee, cost,
  ex-tax revenue, grand total, profit, margin).

### Cost (`cost.ts`)
- `resolveUnitCost({ method, layers?, manualCost?, qty? })` — `moving_average | latest | manual | fifo`.
- `movingAverageUnitCost`, `latestUnitCost`, `fifoConsume(layers, qty)`, `receiveStock(layers, layer)`.

### Stock (`stock.ts`)
- `availableFromLedger(entries[])` — stock = Σ deltas.
- `applyMovement(current, delta, { allowNegative? })` — single movement; blocks negative unless overridden.
- `applyMovements(available, movements[], opts)` → `{ available, entries }` — a whole sale's lines;
  single-writer logic for the stock-ledger Durable Object.

### Terms (`terms.ts`)
- `renderTerms(template, vars)` — fill `{{placeholder}}`s (Thai templates).
- `extractPlaceholders(template)`, `findMissingPlaceholders(template, vars)` — validate before publish.

### Offline sync (`sync.ts`)
- `partitionByClientUuid(alreadyApplied, incoming[])` → `{ fresh, duplicates }` — idempotent apply;
  a sale is never double-counted (server-applied + in-batch repeats).

### Orders / import (`orders.ts`, `imports.ts`)
- `parseCsv(text)` — RFC-4180-ish (quoted fields, doubled quotes, CRLF).
- `orderKey(order)`, `dedupeOrders(existingKeys, incoming[])` — uniqueness by `(channel, external_order_id)`.
- `mapRows(rows, fieldToHeader, requiredFields?)` → `{ records, errors }` — Sheets/CSV normalization.

### Finance (`finance.ts`)
- `buildSaleFinanceRecords(channel, summary)` → `FinanceRecordDraft[]` (satang) — revenue, cost,
  profit, and (when non-zero) VAT and marketplace fee.

## Worked example (VAT 7% inclusive, price 107, cost 60)

- On-site: tax 7, ex-tax revenue 100, profit **40** (margin 40%).
- Online (commission 5% + transaction 2% + fixed 2): fee 9.49, profit **30.51**.

All amounts round to 2 dp at the boundary; intermediate math keeps full precision.
