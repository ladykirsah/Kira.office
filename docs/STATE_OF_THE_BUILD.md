# State of the Build — Handoff

> **Start here if you are picking up this project.** This is the single, current snapshot of what
> is actually built, what is in progress, and what to do next. It is written to let another
> developer or AI agent continue **seamlessly**.
>
> Source-of-truth chain: [DECISIONS.md](DECISIONS.md) (confirmed choices) → this file (as-built
> reality) → the reference docs linked below. When this file disagrees with an older planning doc,
> **this file and the code win** — older docs (`DATA_MODEL.md`, parts of `ARCHITECTURE.md`/`README`)
> describe the original plan and lag the implementation.

**Snapshot:** 2026-06-24 · branch `main` · repo [`ladykirsah/Kira.office`](https://github.com/ladykirsah/Kira.office) (private)
**Tests:** 186 passing across 17 files · **Migrations:** 0000–0012 applied to prod **and** staging D1.

---

## 1. What this product is

Admin back-office for a **Shopee Thailand** auto-A/C-parts seller: products, images, part/vehicle
fitment, inventory, barcode + offline-first POS, pricing/profit (THB, 7% VAT), sales & finance, and
(**later, gated**) Shopee account sync. Owner is non-developer (Thai/English) — UI must be plain and
scannable. Money is stored as **integer satang** everywhere (1 THB = 100 satang).

## 2. Architecture at a glance

```
apps/api      Cloudflare Worker (api.homeseeker.me). RAW SQL over D1. StockLedger Durable Object.
              R2 (images) + KV. Daily backup cron. Optional Cloudflare Access JWT gate.
apps/admin    Next.js 15 (App Router) + React 19 on OpenNext. Calls the Worker from the browser.
packages/core Pure-TS domain logic (pricing, cost, tax, stock, sync, orders, imports, finance). No I/O.
packages/db   D1 schema (Drizzle `schema.ts`, the shape source of truth) + hand-written SQL migrations.
docs/         This handoff set + the original planning docs.
```

Full reference: [API_REFERENCE.md](API_REFERENCE.md) · [SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md) ·
[MODULE_PRODUCT_EDITOR.md](MODULE_PRODUCT_EDITOR.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) ·
backend platform design (intended): [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md).

## 3. What is LIVE / built ✅

**Backend (apps/api — deployed, auto-deploys from `main`):**
- Worker at `https://api.homeseeker.me`, bound to D1 `kira-office` (prod) + `kira-office-staging`,
  R2 `kiraoffice-images`, KV, and the `StockLedger` Durable Object. Daily backup cron `0 19 * * *` (UTC).
- Full REST surface — products CRUD, image gallery, pricing, stock adjust, barcodes, attributes,
  car-fitment tree, sales/refunds, finance summary, CSV imports, idempotent `/sync`, image serving.
  Every endpoint and its request/response shape: **[API_REFERENCE.md](API_REFERENCE.md)**.
- Offline-sale `/sync` is idempotent on `client_uuid`, applies stock as ledger deltas through the
  Durable Object (single writer, blocks oversell, surfaces conflicts).
- Cloudflare Access JWT verification is **implemented but inactive**: it only enforces when
  `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` are set. Today they are unset → **the API is open**. (See §5.)

**Admin (apps/admin — built; runs against the live API):** route pages exist for
`/` (dashboard), `/products`, `/products/new`, `/products/[id]/edit`, `/pos`, `/stock`, `/sales`,
`/orders`, `/finance`, `/pricing`, `/barcodes`, `/import`, `/terms`, `/settings/attributes`,
`/settings/car-fitment`. The **product editor** (view + edit modes, image gallery, pricing, part
attributes, "Fits these cars") and **car-fitment settings** (brand → model/era → service notes,
o-ring usage) are the most developed surfaces — spec in
[MODULE_PRODUCT_EDITOR.md](MODULE_PRODUCT_EDITOR.md).

**Core (packages/core):** pricing/profit, commission/fee math, tax, cost methods, stock helpers,
CSV parse/map, order dedupe, finance — all unit-tested. This is the money-critical, framework-free
layer; change it test-first.

**Recent work (the last feature arc, newest first):** product-view image gallery (350px main +
rows-of-3 thumbnail column); product overview card polish; pricing UI (margin bars, profit emphasis,
slim cost bar); header `[Cancel][Save]`/`[Back][Edit]` with the Edit-auto-save bug fixed; "Last
updated" timestamp; car models as **generations with an era**; per-model **service notes** + **o-ring
usage** table; "Fits these cars" generation picker; managed **part attributes** + **car-fitment**
settings pages. Migrations `0009`–`0012` back these.

## 4. Data & money conventions (do not break)

- **Money → integer satang** in D1; convert at the persistence boundary (`Math.round(thb*100)`).
  `packages/core` computes in THB decimals. Rates → **basis points** (7% → `700`).
- **Timestamps → integer epoch ms (UTC)**, rendered Asia/Bangkok at the edges.
- Schema lives in **two places that must stay in sync**: the SQL files in
  `packages/db/migrations/` (the applied DDL) and `packages/db/src/schema.ts` (Drizzle shapes).
  The Worker does **not** use the Drizzle query builder at runtime — it runs raw `db.prepare(...)`
  SQL. Full table list + the migration workflow: **[SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md)**.

## 5. What is NOT done / next steps ◻️

Ordered roughly by leverage. None of these are blocked by the others.

1. **Auth + audit are not active.** The `users` table exists but there is no user-management UI, and
   there is **no `audit_logs` table** (the planned append-only audit is currently just a `console.log`
   line in the Worker). Cloudflare Access is coded but off. To secure prod: create the Access app,
   set `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` as Worker secrets, then add the audit_logs table + writes.
2. **Shopee live sync (Phase 5, gated).** Needs managed-seller Open API eligibility. The plumbing
   (Queues + dead-letter, the `scheduled()` Shopee hook) is **not built yet**; `sync_jobs` table and
   the CSV order/product importers exist as the bridge. Keep Shopee behind the integration boundary.
3. **Variants are effectively single-per-product.** The schema is variant-ready (`product_variants`,
   per-variant pricing/stock/barcode) but the editor manages one implicit variant. Real variant axes
   (size/pack/etc.) are unconfirmed — see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) #17.
4. **Admin production deploy is unverified.** The app is built and exercised against the live API via
   the dev/preview server; the CORS allowlist names `app.homeseeker.me` as the intended prod origin,
   but whether the admin is actually deployed there was **not** confirmed in this pass. Verify before
   relying on it.
5. **Thai T&C generation** (`terms_patterns`/`product_terms`) — the template endpoint exists; the
   per-product generate+approve flow is not built.
6. **Multi-location, receipt printing, accountant export format** — defaulted assumptions, see
   [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
7. **A full code review never completed** — two attempts were throttled by transient server
   rate-limiting. Re-run when limits clear (see §7).

## 6. How to work here (the gate)

TDD per [AGENTS.md](../AGENTS.md) (and the contributor's global `~/.claude/CLAUDE.md` workrules): no
production logic without a failing test that demands it; money/stock logic is critical-path and must
be tested before change.

```bash
npm install
npm run format        # prettier --write
npm run lint          # prettier --check
npm run typecheck     # tsc: packages/core + apps/api
npm test              # vitest (186 tests) — node env
NEXT_DIST_DIR=.next-verify npm run build:check -w @l-shopee/admin   # admin typecheck+build
```

Deploy: push to `main` → Cloudflare Workers Builds auto-deploys the Worker (~30–60s). Admin changes
are admin-only and need no Worker redeploy.

**Migrations workflow (important):** write a new numbered SQL file in `packages/db/migrations/`,
apply it to **BOTH** prod (`2e88a362-…`) and staging (`85f22f44-…`) D1 (via the Cloudflare D1 MCP
`d1_database_query` or `wrangler d1 migrations apply`), and **mirror the shape in `schema.ts`**.
Keep changes additive/nullable when an older Worker may still be live during rollout (see the
`oring_size` vs `oring_usage` note in migration 0010).

## 7. Known gotchas

- A `<button>` with no `type` defaults to `type="submit"`; inside a form, a `setState` in its
  `onClick` can morph it into the form's submit button and submit on click. Always set
  `type="button"` on non-submit buttons. (This caused the "Edit auto-saves" bug — commit `6f8f9f4`.)
- `schema.ts` defines the attribute tables (`brands`, `product_types`, `usage_categories`,
  `car_brands`) via an `attributeTable()` helper, not literal `sqliteTable("…")` — grep accordingly.
- The demo product `prod-demo` is used for live UI verification. It may carry throwaway sample
  images; real products are unaffected.
- Re-running the multi-agent code review: the workflow script is saved under the session's
  `workflows/scripts/`; it fans out 7 review dimensions with adversarial verification. It returned
  zero findings only because every agent was rate-limited — that is **not** a clean bill of health.
