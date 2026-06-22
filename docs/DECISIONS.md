# Confirmed Decisions

This is the single source of truth for project decisions confirmed by the owner.
All other docs must stay consistent with this file. Update by editing here first.

_Last confirmed: 2026-06-22._

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
| Barcodes | Most products **already have barcodes** (EAN/UPC). Scan existing codes as primary; generate an internal barcode **only when a product has none**. |
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
| Auth | **Cloudflare Access (Zero Trust)** in front + app-level RBAC (4 roles) |
| Edge security | WAF, Rate Limiting, Turnstile, managed TLS, DNS |
| Monorepo | **npm workspaces**; **Node 20+** (LTS recommended), no pnpm |
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
