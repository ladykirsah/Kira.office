# L Shopee Back Office

Admin back-office for a **Shopee Thailand** seller: manage products, stock, barcode-based
on-site selling, pricing/profit, sales + financial records, and (later) Shopee account sync —
from one workspace.

## Current Status

- **Live API on Cloudflare:** the `kiraoffice` Worker is deployed at **`https://api.homeseeker.me`**
  (homeseeker account), backed by **D1** (`kira-office`, APAC) and **KV**, auto-deployed from `main`
  via Workers Builds. GitHub CI (lint/typecheck/test) is green.
- **Live endpoints:** `GET /health`, `POST /pricing/preview`, `GET /products`, `POST /sync`
  (idempotent offline-sale persistence + stock ledger).
- `packages/core` — pure domain logic (pricing/tax/cost/stock/terms/sync/orders/imports/finance),
  built test-first (88 tests). `packages/db` — Drizzle D1 schema, 16 tables migrated.
- **Shopee live API is a gated later phase** — Thailand grants Open API access mainly to managed
  sellers; the back office runs fully without it (CSV bridge meanwhile).
- **Next:** R2 for images (enable R2 in the dashboard), the serialized stock-ledger Durable Object,
  Queues + Cron for Shopee sync, and the Next.js admin UI.

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
  admin/      # Next.js admin + offline-first POS (PWA) — Workers via OpenNext  (stub)
  api/        # Cloudflare Worker: API, /sync, Shopee adapter, queues, ledger DO (stub)
packages/
  core/       # Pure-TS business logic: pricing, profit, tax, cost, stock (TDD)
  db/         # D1 schema + migrations via Drizzle
docs/         # Requirements, architecture, data model, decisions
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
| [docs/DECISIONS.md](docs/DECISIONS.md) | **Confirmed decisions — read first.** |
| [AGENTS.md](AGENTS.md) | Work rules for AI agents and developers. |
| [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) | Product goal, users, assumptions, success criteria. |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Functional and non-functional requirements. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | App module boundaries and platform-independent flows. |
| [docs/CLOUDFLARE_ARCHITECTURE.md](docs/CLOUDFLARE_ARCHITECTURE.md) | **Backend design on Cloudflare** (Workers, D1, Durable Objects, R2, Queues, secrets, auth, deploy). |
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

Confirm the GitHub push target (see the blocker above), then begin Phase 1 of
[docs/ROADMAP.md](docs/ROADMAP.md): initialize the app shells, wire the database, and grow
`packages/core` test-first.
