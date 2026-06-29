# State of the Build — Handoff

> **Start here if you are picking up this project.** This is the single, current snapshot of what
> is actually built, what is in progress, and what to do next. It is written to let another
> developer or AI agent continue **seamlessly**.
>
> Source-of-truth chain: [DECISIONS.md](DECISIONS.md) (confirmed choices) → this file (as-built
> reality) → the reference docs linked below. When this file disagrees with an older planning doc,
> **this file and the code win** — older docs (`DATA_MODEL.md`, parts of `ARCHITECTURE.md`/`README`)
> describe the original plan and lag the implementation.

**Snapshot:** 2026-06-27 · branch `main` · repo [`ladykirsah/Kira.office`](https://github.com/ladykirsah/Kira.office) (private)
**Tests:** 260+ passing · **Migrations:** 0000–0016 applied to prod **and** staging D1.

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

Reference: [API_REFERENCE.md](API_REFERENCE.md) · [SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md) ·
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Module specs:
[Core logic](MODULE_CORE_LOGIC.md) · [Product editor](MODULE_PRODUCT_EDITOR.md) ·
[POS & sync](MODULE_POS_AND_SYNC.md) · [Sales/finance/import](MODULE_SALES_FINANCE_IMPORT.md).
Full navigable index: [docs/README.md](README.md). Intended platform design:
[CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md).

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

**Newest arc — on-site sales + bilingual shop branding (2026-06; migrations `0013`–`0015`):**
**Services** catalogue (`/settings/services`, table + API). **POS rebuild** (`/pos`): selling type
(parts/repair), three add methods (scan / type code / search-dropdown), a per-line **B2C/B2B** price
toggle, **฿ or % discount** spread across lines, services + parts in one cart. **Printable bill**
(`BillDoc`): **Cash bill** (a real sale → `/sync`, deducts stock) vs **Quotation** (print-only),
**Invoice** vs **Receipt** paper, a **Thai/English language switch** (Thai default), a configurable
contact-QR + quotation note; the Invoice stacks under the builder when its column is < 500px.
**Checkout** persists offline-first via the outbox → `/sync`. **Bilingual Shop info**
(`/settings/shop`, a view/edit page mirroring the product detail page): TH+EN shop
name/address/quotation-note/QR-headline/QR-subtitle + **logo and contact-QR image uploads** (R2),
all stored in **KV** (no migration). Money-correctness + security fixes from adversarial bug-hunts:
oversold lines no longer inflate the sale header total; the POS now sends `unitCostSatang` so gross
profit is correct; and the public `/img/` route (which could leak the daily DB backup) is now locked
to the `products/` + `shop/` image namespaces only.

**Prior arc (newest first):** product-view image gallery (350px main +
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

1. **Auth is coded but not active in prod.** Cloudflare Access JWT verification + admin `/api/worker`
   proxy (forwards `Cf-Access-Jwt-Assertion`) + credentialed CORS are built. **`audit_logs` table
   exists** (migration `0016`) and mutations write append-only rows. **[OWNER]** still must create the
   Access app and set `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` Worker secrets, then deploy API + admin.
2. **Shopee live sync (Phase 5, gated).** Needs managed-seller Open API eligibility. D1 mapping
   tables exist (migration `0017`); Queues + live adapter are **not wired** — see
   [NEXT_PHASE_PREP.md](NEXT_PHASE_PREP.md). CSV importers remain the bridge.
3. **Variants are effectively single-per-product.** Option columns on `product_variants` are ready
   (migration `0017`); the editor still manages one implicit variant. Real variant axes are
   unconfirmed — see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) #17.
4. **Admin production deploy is unverified.** The app is built and exercised against the live API via
   the dev/preview server; the CORS allowlist names `app.homeseeker.me` as the intended prod origin,
   but whether the admin is actually deployed there was **not** confirmed in this pass. Verify before
   relying on it.
5. **Thai T&C generation** — D1 `terms_patterns`/`product_terms` + core helpers exist (migration
   `0017`, `packages/core/src/productTerms.ts`); KV template endpoint unchanged; generate+approve UI
   not built. See [NEXT_PHASE_PREP.md](NEXT_PHASE_PREP.md).
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
npm test              # vitest (238 tests) — node env
NEXT_DIST_DIR=.next-verify npm run build:check -w @l-shopee/admin   # admin typecheck+build
```

**Deploy — pushing to `main` does NOT auto-deploy (verified 2026-06-27).** The GitHub Actions
`deploy`/`deploy-admin` jobs **skip** because their `CLOUDFLARE_API_TOKEN` / `CF_ADMIN_API_TOKEN`
secrets are unset (they exit green WITHOUT deploying — never read a green `deploy` check as a real
deploy), and the Cloudflare **Workers Builds** integration fails on every push (its managed token
lacks zone-DNS edit for the custom domain — see §7). **The owner deploys manually:**
`npm run deploy` (API Worker) and `npm run deploy -w @l-shopee/admin` (admin). After any API change,
tell the owner to `npm run deploy` — the change is not live until they do.

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
- **`/img/:key` is public (auth-exempt) so `<img>` tags work — it is the only auth-exempt route.**
  It now hard-restricts reads to `products/` + `shop/` keys; never widen it. The same R2 bucket holds
  the daily DB backup (`backups/*.json`), so anything outside those prefixes must 404. (Hardening TODO:
  move backups to a separate, private R2 bucket — **`Env.BACKUPS` + `backupR2Bucket()` are coded**;
  owner uncomments the binding in `wrangler.jsonc` after creating the bucket.)
- **The admin talks to PROD by default** (`apiBase` → `https://api.homeseeker.me` when
  `NEXT_PUBLIC_API_BASE` is unset). To exercise the admin against unreleased API changes, run the local
  Worker (`wrangler dev --local --port 8787`, Miniflare D1+KV+R2, persists across restarts), write a gitignored
  `apps/admin/.env.local` with `NEXT_PUBLIC_API_BASE=http://localhost:8787`, then **restart** the admin
  dev server (env is inlined at boot). Delete it + restart to return to prod. Never POST mock data to prod.
- **The Next dev console retains stale HMR compile errors** across reloads/restarts. Verify "clean" via
  `build:check` passing + the page rendering with no error boundary — not the console buffer.
- **One CI check fails on every push and is NOT a code bug:** `Workers Builds: kira-office` (Cloudflare's
  redundant Git integration; its managed token lacks zone-DNS edit). Ignore it / disconnect it in the
  Cloudflare dashboard. The real gate is GitHub Actions `build`.
- **Owner's UI vocabulary:** the tall input is the "L input box" (`inputL`), the compact one the "S input
  box" (`inputS`) — both in `apps/admin/src/lib/inputStyles.ts`. Button names when designing:
  **Default button** — Cancel; class `.btn`. **Faded button** — Save draft; class `.btn-soft`.
  **Colored button** — Save product; class `.btn-primary`. **Secondary button** — row Actions dropdown;
  class `.actions-btn`. **Icon button** — borderless inline glyph; class `.icon-btn`.
