# @l-shopee/api

The backend **Cloudflare Worker**: business API, the offline-sync endpoint, the Shopee boundary,
queue consumers, and the stock-ledger Durable Object. Implemented in `src/index.ts` (Worker fetch
handler + `StockLedger` Durable Object) with route tests in `src/index.test.ts`.

## Config

The Worker is already scaffolded. To run it locally, copy `wrangler.jsonc.example` →
`wrangler.jsonc` and fill in the resource ids created with `wrangler d1 create`,
`wrangler kv namespace create`, `wrangler r2 bucket create`, and `wrangler queues create`.

## Responsibilities

- Persist via `@l-shopee/db` (D1 + Drizzle); apply `@l-shopee/core` for pricing/profit/tax/cost.
- **`/sync` endpoint** for the offline POS: idempotent upsert on `onsite_sales.client_uuid`,
  routing stock mutations through the **`STOCK_LEDGER` Durable Object** (single writer, serialized).
- **Order fulfilment**: `PATCH /orders/:id` (AirPlus-channel rows only) edits `order_status` /
  `payment_status` / `carrier` / `tracking_no` and auto-stamps `ship_time_ms` on the first tracking
  number. Two-axis lifecycle — fulfilment `order_status`: new → preparing (เตรียมจัดส่ง) → shipping →
  done (+ cancel/refund); money `payment_status`: awaiting → paid (+ COD). No schema change (existing
  free-text columns).
- **Shopee boundary**: CSV adapter now (order import / stock export); v2 API adapter later (OAuth,
  token refresh, product/order import, stock/listing sync) behind the same interface.
- **Queue consumer** for Shopee sync / image processing / import jobs (with a dead-letter queue).
- **Cron Triggers** for Shopee order polling and token refresh (API phase).

The Worker also serves the admin/back-office API: stock ledger + adjustments, sales, on-site POS +
drafts, payments, customers, pricing preview, and imports.

## Bindings

`DB` (D1) · `STOCK_LEDGER` (Durable Object) · `R2` · `IMAGES` · `KV` · `SHOPEE_QUEUE` (Queues) ·
secrets `AUTH_SECRET`, `SHOPEE_PARTNER_KEY`. Full design + example config in
[../../docs/CLOUDFLARE_ARCHITECTURE.md](../../docs/CLOUDFLARE_ARCHITECTURE.md).

## Secrets

Read Shopee credentials from Secrets Store / Worker secrets, never from source. Local dev uses
`.dev.vars` (gitignored); see `../../.env.example` for the variable names.
