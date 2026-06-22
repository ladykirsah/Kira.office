# @l-shopee/api

The backend **Cloudflare Worker**: business API, the offline-sync endpoint, the Shopee boundary,
queue consumers, and the stock-ledger Durable Object. Not yet initialized — intentional stub.

## Initialize (Phase 1)

```bash
# from repo root
npm create cloudflare@latest -- apps/api --type=hello-world --ts
# then add Hono for routing/middleware
npm install -w @l-shopee/api hono
```

Copy `wrangler.jsonc.example` → `wrangler.jsonc` and fill in the resource ids created with
`wrangler d1 create`, `wrangler kv namespace create`, `wrangler r2 bucket create`, and
`wrangler queues create`.

## Responsibilities

- Persist via `@l-shopee/db` (D1 + Drizzle); apply `@l-shopee/core` for pricing/profit/tax/cost.
- **`/sync` endpoint** for the offline POS: idempotent upsert on `onsite_sales.client_uuid`,
  routing stock mutations through the **`STOCK_LEDGER` Durable Object** (single writer, serialized).
- **Shopee boundary**: CSV adapter now (order import / stock export); v2 API adapter later (OAuth,
  token refresh, product/order import, stock/listing sync) behind the same interface.
- **Queue consumer** for Shopee sync / image processing / import jobs (with a dead-letter queue).
- **Cron Triggers** for Shopee order polling and token refresh (API phase).

## Bindings

`DB` (D1) · `STOCK_LEDGER` (Durable Object) · `R2` · `IMAGES` · `KV` · `SHOPEE_QUEUE` (Queues) ·
secrets `AUTH_SECRET`, `SHOPEE_PARTNER_KEY`. Full design + example config in
[../../docs/CLOUDFLARE_ARCHITECTURE.md](../../docs/CLOUDFLARE_ARCHITECTURE.md).

## Secrets

Read Shopee credentials from Secrets Store / Worker secrets, never from source. Local dev uses
`.dev.vars` (gitignored); see `../../.env.example` for the variable names.
