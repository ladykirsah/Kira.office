# State of the Build — Handoff

> **Start here if you are picking up this project.** This is the single, current snapshot of what
> is actually built, what is in progress, and what to do next. It is written to let another
> developer or AI agent continue **seamlessly**.
>
> Source-of-truth chain: [DECISIONS.md](DECISIONS.md) (confirmed choices) → this file (as-built
> reality) → the reference docs linked below. When this file disagrees with an older planning doc,
> **this file and the code win** — older docs (`DATA_MODEL.md`, parts of `ARCHITECTURE.md`/`README`)
> describe the original plan and lag the implementation.

**Snapshot:** 2026-07-19 · working branch `claude/airplus-publication-plan-08e4c7` (PR open to `main`) · repo [`ladykirsah/Kira.office`](https://github.com/ladykirsah/Kira.office) (private)
**Tests:** 718 passing · **Migrations:** `0000`–`0047` + `0053`–`0055` (`0048`–`0052` live on the parked `returns` branch — see §3).
**AirPlus is LIVE in production** at [`airplusauto.com`](https://airplusauto.com) (Worker `airplus-storefront`, Version `e212cc60`, deployed 2026-07-19). ⚠️ The prod catalog is still **demo data** (e.g. a "ครีมบำรุงผิว (Demo)" skincare cream shows as top best-seller) — real catalog load is the first post-launch task.

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
apps/storefront  AirPlus customer store (Next.js 15 on OpenNext, its own Worker). Shares api's D1 + KV;
              cross-binds StockLedger DO. Guest checkout + phone-OTP member accounts.
packages/core Pure-TS domain logic (pricing, cost, tax, stock, sync, orders, imports, finance). No I/O.
packages/db   D1 schema: hand-written SQL migrations (the source of truth). No TypeScript.
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
- Offline-sale `/sync` is idempotent on `client_uuid` (enforced by a D1 UNIQUE index), applies stock
  as ledger deltas through the Durable Object, and surfaces oversell as conflicts. **The DO is a
  stateless RPC hop, not a serialized writer** — the oversell check races (CLOUDFLARE_ARCHITECTURE.md).
- Cloudflare Access JWT verification is **implemented but inactive**: it only enforces when
  `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` are set. Today they are unset → **the API is open**. (See §5.)

**Admin (apps/admin — built; runs against the live API):** route pages exist for
`/` (dashboard), `/products`, `/products/new`, `/products/[id]/edit`, `/pos`, `/stock`, `/sales`,
`/orders`, `/finance`, `/pricing`, `/barcodes`, `/import`, `/terms`, `/settings/attributes`,
`/settings/car-fitment`. The **product editor** (view + edit modes, image gallery, pricing, part
attributes, "Fits these cars") and **car-fitment settings** (brand → model/era → service notes,
o-ring usage) are the most developed surfaces — spec in
[MODULE_PRODUCT_EDITOR.md](MODULE_PRODUCT_EDITOR.md). **Order fulfilment** is now wired: the admin
**Sales → AirPlus** tab edits `order_status` / `payment_status` / `carrier` / `tracking_no` (Save →
**`PATCH /orders/:id`**, AirPlus-channel only, which auto-stamps `ship_time_ms` on the first tracking
number) — this routes the previously-unrouted `updateOrder()` and fixes the admin Save 404 (the
customer `/orders` page stays read-only tracking). **Owner decision — a two-axis
lifecycle, no schema change** (existing free-text columns): `order_status` (fulfilment)
`new → preparing (เตรียมจัดส่ง) → shipping → done`, plus **cancel** / **refund** branches; `payment_status`
(money) `awaiting → paid`, plus **COD**. The admin status dropdown is trimmed to fulfilment-only.

**Core (packages/core):** pricing/profit, commission/fee math, tax, cost methods, stock helpers,
CSV parse/map, order dedupe, finance — all unit-tested. This is the money-critical, framework-free
layer; change it test-first. Now also consumed by `apps/storefront` (coupons, campaigns, payments).

**Storefront (apps/storefront — LIVE in production at `airplusauto.com`):** the customer-facing **AirPlus**
car-parts store — its own Cloudflare Worker (Next.js 15 / OpenNext) that shares the back office's D1 +
KV and cross-binds the `StockLedger` DO. **Home v2** landing (shortcut bar, collections, a timed
flash-sale hero, best-sellers, shop-by-brand, categories, promo banners, recently-viewed) plus a
dedicated **`/search`** landing (recent-search chips, car-logo tiles, case-driven suggestions). Catalog
+ fitment search, a bottom-sheet product filter, four `ctx`-marked browse contexts on `/products`
(🛒 Products / 🗂️ Categories / 🚗 Car Fitment / 🏷️ On Sale), an image-first **PDP** with a header **Share**
action + collapsible section blocks, a **compact cart** → **guest checkout** (PromptPay QR / transfer /
COD + slip upload), and order tracking by phone+order-no (submit-gated until ref + full phone; a
deep-link entry hides the form and shows only that order). **Phone-OTP member accounts** via **`/login`**
(login | register mode tabs; new members get a PDPA consent panel; a 6-box OTP with a resend
countdown) — `POST /api/auth/otp/send` enforces a registration gate (login → registered-only,
register → new-only) and `POST /api/auth/otp/verify` enforces the consent invariant; backed by
`storefront_sessions` + throttle, a Turnstile seam, and `OTP_DEV_ECHO` on staging. An **`/account`** hub
(`/account/orders`, `/account/addresses`, a PDPA consent-receipt card, and a mock **`/account/coupons`**
wallet — localStorage via `lib/coupons.ts`, no backend yet — paired with a `/coupons` collect catalog).
Agent-discovery route handlers (`/llms.txt`, `/sitemap.md`, `/skills.md`, `/rss.xml`, `/sitemap.xml`) and
`/privacy` + `/terms` legal drafts are live. Every LINE help action (home shortcut, PDP sticky bar,
account "ช่วยเหลือ" tile, home follow strip) opens the shop's **LINE OA add-friend link directly**
(`lin.ee/tltIFtI` → `@811gvdun`, in `lib/links.ts`). Money
never trusts the client (server re-prices), stock deducts through the shared DO. Migrations `0036`–`0047`
add its schema. **Deployed to PRODUCTION** at [`airplusauto.com`](https://airplusauto.com) (Worker `airplus-storefront`,
Version `e212cc60`, deployed 2026-07-19), sharing the prod D1 `kira-office`. The phone-viewable
**staging** preview at `airplus-storefront-staging.bettergogocash.workers.dev` remains for pre-prod
checks. **Login is now LINE-first** (this branch): the phone+OTP flow is hidden behind
`NEXT_PUBLIC_OTP_ENABLED`, sign-up is a minimal LINE flow (casual username + one required delivery
address with the phone captured *inside* the address, since D1 can't null `storefront_customers.phone`
— 4 incoming FKs), and the brand skin moved coral → **red DENSO CI** (`--brand #e10000`, blue reserved
for count highlights + genuine/แท้ trust). ⚠️ **The prod catalog is still demo data** (see the snapshot
banner at the top) — loading the real catalog is the first post-launch task. The demo flash campaign is **permanently seeded in
the staging D1** (`seed-camp-1`, window `2025-01-01`→`2028-01-01`) — this is DATA, not schema — so the
Flash Sale hero, the สินค้าลดราคา home collection, and the PDP discount always render as a mock. The
customer-facing UI has since had a coral-CI polish pass (Shopee-style PDP section blocks, a shared
gray-detail / green-status info-pill + outline discount-tag system, a tinted sticky add-to-cart bar, and
`router.replace` in-page filtering so the header back arrow returns to the previous page). Full
app README + deploy runbook: [apps/storefront/README.md](../apps/storefront/README.md).

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
- **Product ID is the single identifier; the barcode is made from it** (2026-06-29). `product_ref`
  (the "Product ID") is the SOLE identifier (variant SKU + CSV-import key) and the barcode source. The
  owner scans manufacturer box barcodes; a part without one gets a **Code-128 barcode minted from its
  Product ID** — no random internal EAN-13 (that generator was removed), and a real scanned barcode is
  never overwritten. Core helper: `resolveProductBarcode`. **Done:** core rule, API
  (`createProduct`/`importProducts`/`addBarcodeToProduct` + all reads now key on `product_ref`), the
  Add **and** Edit flows (Product ID required and **merged with the barcode into one field** — type
  or scan; the barcode is created from it and previewed beside it, no separate barcode input),
  and **migration `0018`** which backfills `product_ref`, makes it `UNIQUE`, and **drops the
  `product_code` column** (applied to local D1; **[OWNER]** applies to prod + staging at deploy —
  fails loudly if duplicate Product IDs exist; rollback = re-add the column or restore the daily
  backup).
- Schema lives in **one place**: the SQL files in `packages/db/migrations/` (the applied DDL).
  There is no `schema.ts` — the Drizzle draft was never compiled or imported and was deleted. The
  Worker runs raw `db.prepare(...)` SQL against D1 and imports no ORM. Full table list + the
  migration workflow: **[SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md)**.

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
npm test              # vitest (632 tests) — node env
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
`d1_database_query` or `wrangler d1 migrations apply`), and **update
[SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md)** so the as-built table listing stays honest.
Keep changes additive/nullable when an older Worker may still be live during rollout (see the
`oring_size` vs `oring_usage` note in migration 0010).

## 7. Known gotchas

- A `<button>` with no `type` defaults to `type="submit"`; inside a form, a `setState` in its
  `onClick` can morph it into the form's submit button and submit on click. Always set
  `type="button"` on non-submit buttons. (This caused the "Edit auto-saves" bug — commit `6f8f9f4`.)
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
  box" (`inputS`) — both in `apps/admin/src/lib/inputStyles.ts`.
