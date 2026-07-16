# @l-shopee/db

**Cloudflare D1** (SQLite) schema, defined as hand-written SQL migrations in
[`migrations/`](./migrations/).

> **Source of truth:** the numbered SQL files in `migrations/` are the *only* definition of the
> schema — they are the DDL actually applied to D1. The as-built shape is documented in
> [../../docs/SCHEMA_AS_BUILT.md](../../docs/SCHEMA_AS_BUILT.md). This package ships **no
> TypeScript**: nothing imports `@l-shopee/db` at runtime. A Drizzle `src/schema.ts` draft used to
> live here; it was never compiled, never imported, `drizzle-kit` was never installed (so it never
> generated a migration), and it had drifted from the applied DDL — it was deleted rather than left
> to read as a source of truth. If a typed query layer is wanted later, generate it *from* the
> migrations.

## Conventions

- **Money → `INTEGER` satang** (THB minor units). `satang = Math.round(thb * 100)`. Never floats.
- **Rates → `INTEGER` basis points** (7% → `700`).
- **Enums → `TEXT`** with a fixed value set, enforced by an explicit SQL `CHECK` constraint.
- **Timestamps → `INTEGER` epoch ms (UTC)**; render in Asia/Bangkok at the edges.

## Adding a migration

Write the next numbered `NNNN_name.sql` by hand in [`migrations/`](./migrations/) (additive +
nullable when adding a column to a live table), then apply it:

```bash
wrangler d1 migrations apply kira-office --local   # local dev
wrangler d1 migrations apply kira-office           # remote (per environment with --env)
```

The database is bound in each Worker's `wrangler.jsonc` as `DB` (see
[../../docs/CLOUDFLARE_ARCHITECTURE.md](../../docs/CLOUDFLARE_ARCHITECTURE.md)). Key DB-level
invariants: `onsite_sales.client_uuid` UNIQUE, `(sales_orders.channel, external_order_id)` UNIQUE,
`barcodes.barcode_value` UNIQUE. Stock on-hand is always `SUM(quantity_delta)` over
`stock_ledger_entries` — never a stored total.

**Alternative:** if D1 limits are reached, switch to Postgres behind **Hyperdrive**; money can move
to `NUMERIC`.
