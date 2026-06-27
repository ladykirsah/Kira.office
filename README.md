# L Shopee Back Office

Admin back-office for a **Shopee Thailand** seller: manage products, stock, barcode-based
on-site selling, pricing/profit, sales + financial records, and (later) Shopee account sync —
from one workspace.

## Current Status

> **Picking this up?** Read **[docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md)** — the current
> as-built snapshot (what's done, in progress, and next). The summary below is the short version.

- **Live API on Cloudflare:** the `kira-office` Worker runs at **`https://api.homeseeker.me`**,
  backed by **D1** (`kira-office`) + **R2** (`kiraoffice-images`) + **KV** + the **`StockLedger`
  Durable Object**, with a daily backup cron. **Deploy is manual** (`npm run deploy`) — pushing to
  `main` does **not** auto-deploy (CI deploy jobs skip on unset secrets; Workers Builds fails on the
  custom-domain DNS). See [docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md) §6.
- **Full REST surface** — products CRUD + image gallery, pricing, stock/ledger, barcodes, attributes,
  car-fitment tree, services, **bilingual shop info + logo/QR uploads**, sales/refunds, finance, CSV
  imports, idempotent `/sync`. See [docs/API_REFERENCE.md](docs/API_REFERENCE.md).
- **Admin app (Next.js 15 / React 19, OpenNext)** is built: product editor, car-fitment + attribute +
  services + **shop-info (view/edit, bilingual)** settings, a full **on-site POS** (parts/repair,
  scan/code/search, B2C/B2B pricing, ฿/% discount) with a **printable bill** (Cash bill vs Quotation,
  Invoice vs Receipt, **Thai/English switch**, contact-QR), stock, sales, finance, import, terms.
- `packages/core` — pure domain logic, test-first. **238 tests** across `core` + `api`.
  `packages/db` — Drizzle schema + 16 SQL migrations (`0000`–`0015`); see
  [docs/SCHEMA_AS_BUILT.md](docs/SCHEMA_AS_BUILT.md). (Shop settings live in **KV**, not D1.)
- **Shopee live API is a gated later phase** — Thailand grants Open API access mainly to managed
  sellers; the back office runs fully without it (CSV bridge meanwhile).
- **Next:** activate Cloudflare Access auth + an `audit_logs` table; move the daily backup to a private
  R2 bucket; the logo on the printed bill; the Sales online/on-site channel split; Shopee sync (Queues
  + Cron). Details in [docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md) §5.

## Confirmed Scope

- Admin back office with roles and audit logging.
- Add/edit products; upload + reorder images; categorize by type, brand, usage.
- Product variants and barcode management (use existing EAN/UPC; generate internal only if missing).
- Auto-generate Thai product terms & conditions from reusable patterns (review before publish).
- Pricing with cost, **per-product VAT (7%, inclusive/exclusive)**, Shopee fees, and profit.
- On-site **offline-first** barcode selling tied to a single stock ledger.
- Sales table + financial records for **both online (Shopee) and on-site** sales.
- Local-first Shopee linkage; CSV bridge now, live v2 API later.

## Repository Layout

Backend runs on the **Cloudflare developer platform** (Workers, D1, Durable Objects, R2, Queues,
KV) — see [docs/CLOUDFLARE_ARCHITECTURE.md](docs/CLOUDFLARE_ARCHITECTURE.md).

```
apps/
  admin/      # Next.js admin + offline-first POS (PWA) — Workers via OpenNext  (built)
  api/        # Cloudflare Worker: API, /sync, ledger DO, image serving           (live)
packages/
  core/       # Pure-TS business logic: pricing, profit, tax, cost, stock (TDD)
  db/         # D1 schema (Drizzle) + hand-written SQL migrations
docs/         # Handoff set + requirements, architecture, data model, decisions
```

## Getting Started

```bash
npm install
npm test            # runs packages/core Vitest suite
npm run typecheck
npm run lint
```

App initialization steps live in [apps/admin/README.md](apps/admin/README.md) and
[apps/api/README.md](apps/api/README.md).

## Documentation Map

| File | Purpose |
| --- | --- |
| [docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md) | **As-built snapshot — what's done, in progress, next. Start here to continue.** |
| [docs/DECISIONS.md](docs/DECISIONS.md) | **Confirmed decisions — read first.** |
| [AGENTS.md](AGENTS.md) | Work rules for AI agents and developers. |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Every Worker REST endpoint + request/response shape. |
| [docs/SCHEMA_AS_BUILT.md](docs/SCHEMA_AS_BUILT.md) | Real D1 schema (migrations 0000–0012) + migration workflow. |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI tokens, component patterns, formatting conventions. |
| [docs/README.md](docs/README.md) | **Documentation index** — full reading order for the docs folder. |
| Module specs | [Core logic](docs/MODULE_CORE_LOGIC.md) · [Product editor](docs/MODULE_PRODUCT_EDITOR.md) · [POS & sync](docs/MODULE_POS_AND_SYNC.md) · [Sales/finance/import](docs/MODULE_SALES_FINANCE_IMPORT.md) |
| [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) | Product goal, users, assumptions, success criteria. |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Functional and non-functional requirements. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | App module boundaries and platform-independent flows. |
| [docs/CLOUDFLARE_ARCHITECTURE.md](docs/CLOUDFLARE_ARCHITECTURE.md) | **Backend design on Cloudflare** (Workers, D1, Durable Objects, R2, Queues, secrets, auth, deploy). |
| [docs/PRODUCTION_LAUNCH.md](docs/PRODUCTION_LAUNCH.md) | **Production launch plan** — environments, security, go-live runbook, rollback, owner actions. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Database entities and relationships (D1). |
| [docs/PRICING_AND_FINANCE.md](docs/PRICING_AND_FINANCE.md) | Pricing/profit formulas (on-site vs online), VAT, cost methods. |
| [docs/BARCODE_AND_INVENTORY.md](docs/BARCODE_AND_INVENTORY.md) | Barcode, stock ledger, offline POS workflows. |
| [docs/SHOPEE_INTEGRATION.md](docs/SHOPEE_INTEGRATION.md) | Shopee plan, TH API constraint, CSV bridge, gated API phase. |
| [docs/PRODUCT_TERMS_PATTERNS.md](docs/PRODUCT_TERMS_PATTERNS.md) | Thai T&C template strategy. |
| [docs/DATA_IMPORT.md](docs/DATA_IMPORT.md) | Google Sheets / CSV import plan. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Development phases. |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | Resolved answers + remaining minor questions. |
| [docs/GITHUB_CHECKLIST.md](docs/GITHUB_CHECKLIST.md) | Steps + blocker to publish to GitHub. |

## Recommended Next Step

The foundation, API, and admin UI are built. See
[docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md) §5 for the prioritized next steps —
activating Cloudflare Access auth + audit logging is the highest-leverage one before production use.
