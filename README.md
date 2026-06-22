# L Shopee Back Office

Documentation-first scaffold for a Shopee seller back-office system.

The product goal is to manage products, stock, barcode-based on-site selling, pricing, sales records, and Shopee seller account synchronization from one admin workspace.

## Current Status

- Project folder scaffolded with Markdown planning files.
- No application code has been generated yet.
- Shopee Open Platform details must be verified in the seller/developer console before implementation.
- GitHub push is blocked until the exact repository URL or desired repository name is confirmed.

## Confirmed Needs

- Admin back office.
- Add new product section.
- Upload product information and images in one place.
- Link local product stock numbers to the e-commerce account.
- Barcode scanning for stock management and on-site selling.
- Product categorization by type, brand, and usage.
- Auto-generate product terms and conditions from approved patterns.
- Pricing management for cost, tax, Shopee/e-commerce commission, and profit.
- Sales table and financial record for both online and on-site sales.
- Shopee seller account integration through Shopee Open Platform.

## Documentation Map

| File | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Project-specific work rules for AI agents and developers. |
| [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) | Product goal, users, assumptions, and success criteria. |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Functional and non-functional requirements. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Proposed architecture and implementation defaults. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Initial database entities and relationships. |
| [docs/SHOPEE_INTEGRATION.md](docs/SHOPEE_INTEGRATION.md) | Shopee Open Platform integration plan and API areas. |
| [docs/BARCODE_AND_INVENTORY.md](docs/BARCODE_AND_INVENTORY.md) | Barcode, stock, and on-site sales workflows. |
| [docs/PRICING_AND_FINANCE.md](docs/PRICING_AND_FINANCE.md) | Pricing formulas, fee handling, and financial records. |
| [docs/PRODUCT_TERMS_PATTERNS.md](docs/PRODUCT_TERMS_PATTERNS.md) | Terms and conditions template strategy. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Suggested development phases. |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | Questions to finalize before code starts. |
| [docs/GITHUB_CHECKLIST.md](docs/GITHUB_CHECKLIST.md) | Steps needed to publish this folder to GitHub. |

## Recommended Next Step

Answer the questions in [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md). After those are settled, implementation can start with a narrow MVP:

1. Admin login.
2. Product catalog and image upload.
3. Barcode/SKU stock ledger.
4. Manual on-site sale.
5. Shopee authorization and product/order sync.
6. Pricing and profit calculations.
