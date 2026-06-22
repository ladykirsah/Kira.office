# @l-shopee/db

**Cloudflare D1** (SQLite) schema and migrations, defined with **Drizzle ORM**.

> **Status:** `src/schema.ts` is a **representative draft** demonstrating the D1 conventions
> (integer satang money, text enums, integer-ms timestamps, the `client_uuid` idempotency key and
> `channel+external_order_id` uniqueness). The complete entity set is in
> [../../docs/DATA_MODEL.md](../../docs/DATA_MODEL.md). Drizzle is installed in Phase 1; the schema
> is **not yet compiled or migrated** to keep the current lockfile clean.

## Conventions

- **Money → `INTEGER` satang** (THB minor units). `satang = Math.round(thb * 100)`. Never floats.
- **Rates → `INTEGER` basis points** (7% → `700`).
- **Enums → `TEXT`** with a fixed value set (Drizzle `enum` option → CHECK at the SQL layer).
- **Timestamps → `INTEGER` epoch ms (UTC)**; render in Asia/Bangkok at the edges.

## Initialize (Phase 1)

```bash
# from repo root
npm install -w @l-shopee/db drizzle-orm
npm install -w @l-shopee/db -D drizzle-kit
wrangler d1 create l-shopee                 # note the database_id for wrangler.jsonc
npx -w @l-shopee/db drizzle-kit generate    # SQL migrations -> packages/db/migrations
wrangler d1 migrations apply l-shopee --local   # local dev
wrangler d1 migrations apply l-shopee           # remote (per environment with --env)
```

Bind the database in each Worker's `wrangler.jsonc` as `DB` (see
[../../docs/CLOUDFLARE_ARCHITECTURE.md](../../docs/CLOUDFLARE_ARCHITECTURE.md)). Key DB-level
invariants: `onsite_sales.client_uuid` UNIQUE, `(sales_orders.channel, external_order_id)` UNIQUE,
`barcodes.barcode_value` UNIQUE.

**Alternative:** if D1 limits are reached, switch to Postgres behind **Hyperdrive** — Drizzle
supports the `postgres` dialect, and money can move to `NUMERIC`.
