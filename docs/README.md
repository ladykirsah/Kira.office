# Documentation Index

Reading order for someone (human or AI) continuing this project.

## 1. Start here
| Doc | What it gives you |
| --- | --- |
| [STATE_OF_THE_BUILD.md](STATE_OF_THE_BUILD.md) | **As-built snapshot** — what's done, in progress, next; gotchas; the dev gate. Read first. |
| [DECISIONS.md](DECISIONS.md) | Confirmed business/technical decisions (source of truth). |
| [../AGENTS.md](../AGENTS.md) | Work rules for AI agents + developers (TDD, Cloudflare, Shopee, GitHub). |
| [../README.md](../README.md) | Repo overview + getting started. |

## 2. Reference (as-built)
| Doc | What it gives you |
| --- | --- |
| [API_REFERENCE.md](API_REFERENCE.md) | Every Worker REST endpoint + request/response shape. |
| [SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md) | Real D1 schema (migrations 0000–0012) + migration workflow. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | UI tokens, component patterns, formatting conventions. |

## 3. Module specifications
| Doc | Covers |
| --- | --- |
| [MODULE_CORE_LOGIC.md](MODULE_CORE_LOGIC.md) | `packages/core` — pricing, tax, cost methods, stock, sync, finance, imports, terms. |
| [MODULE_PRODUCT_EDITOR.md](MODULE_PRODUCT_EDITOR.md) | Admin product editor + car-fitment settings + save flow. |
| [MODULE_POS_AND_SYNC.md](MODULE_POS_AND_SYNC.md) | Offline-first POS, outbox, `/sync`, the StockLedger Durable Object. |
| [MODULE_SALES_FINANCE_IMPORT.md](MODULE_SALES_FINANCE_IMPORT.md) | Sales, refunds, finance summary, CSV import bridge. |

## 4. Design & planning (background / intent)
| Doc | Covers |
| --- | --- |
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | Goal, users, assumptions, success criteria. |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional + non-functional requirements. |
| [ROADMAP.md](ROADMAP.md) | Development phases (with current status). |
| [ARCHITECTURE.md](ARCHITECTURE.md) | App module boundaries + platform-independent flows. |
| [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md) | Intended backend platform design (Workers, D1, DO, R2, Queues, secrets, auth, deploy). |
| [PRICING_AND_FINANCE.md](PRICING_AND_FINANCE.md) | Pricing/profit/VAT/cost formulas (authoritative math). |
| [BARCODE_AND_INVENTORY.md](BARCODE_AND_INVENTORY.md) | Barcode + stock + offline POS workflows. |
| [DATA_MODEL.md](DATA_MODEL.md) | Original schema **plan** (see SCHEMA_AS_BUILT for reality). |
| [PRODUCT_TERMS_PATTERNS.md](PRODUCT_TERMS_PATTERNS.md) | Thai T&C template strategy. |
| [SHOPEE_PRODUCT_EDITOR.md](SHOPEE_PRODUCT_EDITOR.md) | Notes on Shopee Seller-Centre's editor (UI reference). |

## 5. Operations & Shopee
| Doc | Covers |
| --- | --- |
| [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md) | Environments, security, go-live runbook, rollback, owner actions. |
| [HARDENING.md](HARDENING.md) | Security hardening notes. |
| [SHOPEE_INTEGRATION.md](SHOPEE_INTEGRATION.md) | Shopee plan, TH API constraint, CSV bridge, gated API phase. |
| [DATA_IMPORT.md](DATA_IMPORT.md) | Google Sheets / CSV import plan. |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Resolved answers + remaining minor questions. |
| [GITHUB_CHECKLIST.md](GITHUB_CHECKLIST.md) | Repo publish steps. |

> **Doc currency:** §1–§3 reflect the code as built (2026-06-24). §4–§5 mix as-built with original
> intent — where a planning doc disagrees with the code, the code + §1–§3 win. Keep this index and
> STATE_OF_THE_BUILD updated when contracts, schema, or module behavior change.
