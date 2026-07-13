# Confirmed Decisions

This is the single source of truth for project decisions confirmed by the owner.
All other docs must stay consistent with this file. Update by editing here first.

_Last confirmed: 2026-07-13._

## Business

| Topic | Decision |
| --- | --- |
| Market / region | **Shopee Thailand** |
| Currency | **THB** (Thai Baht) |
| VAT | **7%** default. **Per-product** flag for VAT-inclusive vs VAT-exclusive prices. Rate is configurable. Seller is assumed VAT-registered; can be turned off. |
| Cost method for profit | System supports **all four**: `moving_average`, `latest`, `manual`, `fifo`. Selectable per shop (default `moving_average`); cost is snapshotted onto each sale line. |
| On-site (POS) profit | `(price − discount) − tax − cost`. **No marketplace commission.** The `− tax` term only applies to VAT-**inclusive** prices (tax is embedded); for VAT-exclusive prices tax is added on top and is not subtracted from profit. Authoritative per-case math: [PRICING_AND_FINANCE.md](PRICING_AND_FINANCE.md). |
| Online (Shopee) profit | Same as on-site **plus** Shopee commission/transaction/service/fixed fees subtracted. |
| Fees | Auto-suggested defaults, **manually adjustable as %**. |
| Product T&Cs language | **Thai only** |
| Existing data | Owner has product/order data in **Google Sheets** (partial). Importer required. |

## Product / catalog

| Topic | Decision |
| --- | --- |
| Product ID | The **Product ID** (`product_ref`, the manufacturer/catalog part no.) is the **sole** product identifier and the barcode source. The old internal `product_code` (`P-…`) was **removed entirely** in migration `0018` — there is no `product_code` column; `product_ref` is `UNIQUE` (app-required, since SQLite can't add NOT NULL in place) and is the variant SKU + CSV-import key. |
| Barcodes | The owner **scans the manufacturer's box barcode** (confirmed 2026-06-29: those are themselves encodings of the Product ID). When a part ships **without** a barcode, the shop **mints one from the Product ID** (verbatim, rendered as Code 128) — **never a random/internal EAN-13** (that generator was removed). An existing scanned/real barcode is **never overwritten**. Logic: `@l-shopee/core` `resolveProductBarcode` / `deriveBarcodeFromProductId`. |
| Product status | Two **independent** states: on-site `status` (draft / active / archived) and **live on Shopee** (`shopee_listed`). The editor's **"Active on Shopee"** toggle (next to the Shopee ID) controls Shopee-listed — turning it on also marks the product active on-site; turning it off leaves the on-site status as-is. The products list reflects this as **Listed / Not listed / Pause**. |
| Variants | Enabled (size / color / scent / bundle / pack quantity). _Assumption — confirm exact variant axes._ |
| Categorization | By **type**, **brand**, and **usage**. |
| Images | Upload + reorder; keep originals (compression optional later). |

## On-site selling

| Topic | Decision |
| --- | --- |
| Offline support | **Full offline-first POS.** The sale screen keeps scanning and completing sales with no internet; stock + sales sync automatically when connection returns. |
| Locations | Single location for MVP; schema is **multi-location-ready**. _Assumption._ |
| Payment methods | **Cash + PromptPay** (card optional). _Assumption._ |
| Discounts / overrides | Staff may apply discount; **price override is owner-only**. _Assumption._ |
| Receipt printing | Optional, off for MVP. _Assumption._ |

## Order fulfilment (AirPlus storefront)

| Topic | Decision |
| --- | --- |
| Two-axis order lifecycle | Orders track **two independent axes**. Fulfilment `order_status`: `new` → `preparing` (เตรียมจัดส่ง) → `shipping` → `done`, plus **cancel** / **refund** branches. Money `payment_status`: `awaiting` → `paid`, plus **COD**. The admin status dropdown exposes **fulfilment states only**. |
| Schema impact | **No schema change** — reuses the existing free-text status columns. |
| Scope | Applies to **AirPlus-channel** orders only. |

## Shopee integration

| Topic | Decision |
| --- | --- |
| Approach | **Local-first now, live API later.** Build the full back office first; bridge Shopee via **CSV import/export** from Seller Centre; switch on the live API as a gated phase. |
| API eligibility | Shopee **Thailand grants Open API access mainly to managed sellers (with a Key Account Manager)**. Owner does not yet have a Shopee Open Platform app. Live API is **gated** on confirming eligibility. See [SHOPEE_INTEGRATION.md](SHOPEE_INTEGRATION.md). |
| API version | **v2** only (new developers are approved for v2). |
| Historical import | Last **90 days** when API/CSV available. _Assumption._ |
| Stock-reducing status | Stock reduces when a Shopee order reaches **Ready to ship / Paid**. _Assumption._ |

## Technical

Backend runs on the **Cloudflare developer platform**. Full design: [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md).

| Topic | Decision |
| --- | --- |
| Frontend | **Next.js + TypeScript** (App Router), deployed to **Cloudflare Workers** via the **OpenNext** adapter; PWA for offline POS |
| API / jobs | **Cloudflare Workers** (`apps/api`) |
| Database | **Cloudflare D1** (SQLite) with **Drizzle ORM**; money stored as **integer satang**. *Alt: Hyperdrive + Postgres if D1 limits are hit.* |
| Stock consistency | **Durable Objects** serialize the stock ledger + make offline-sale sync idempotent |
| Object storage | **R2** (image originals) + **Cloudflare Images** (transforms) |
| Async / scheduled | **Queues** (+ dead-letter queue) and **Cron Triggers** for Shopee sync, import, stock push, polling |
| Cache / config | **Workers KV** |
| Secrets | **Secrets Store / Worker secrets**; local dev via `.dev.vars` (never committed) |
| Auth | **Admin/back-office:** Cloudflare Access (Zero Trust) in front + app-level RBAC (4 roles). **Storefront customers:** phone-OTP login/register with a PDPA-consent gate on new-member signup. |
| Edge security | WAF, Rate Limiting, Turnstile, managed TLS, DNS |
| Monorepo | **npm workspaces**; **Node 22** (Wrangler requires ≥22; pinned via `.nvmrc` + CI), no pnpm |
| Core logic package | `packages/core` — pure TypeScript, framework-free, **TDD-first** |
| Tests | **Vitest**; browser tests for critical flows later |
| Barcode input | USB scanner (keyboard emulation) as baseline; camera + manual entry as fallback |

## Repository

| Topic | Decision |
| --- | --- |
| Name | `Kira.office` (npm workspace root id: `kira-office`) |
| Visibility | **Private** |
| Owner / status | **Published** at [`ladykirsah/Kira.office`](https://github.com/ladykirsah/Kira.office) (private). See [GITHUB_CHECKLIST.md](GITHUB_CHECKLIST.md). |

## Items marked _Assumption_

These were defaulted to keep momentum and are safe to change. Confirm when convenient:
variant axes · single vs multiple locations · on-site payment methods · receipt printing ·
historical-import window · which Shopee order statuses reduce stock.
