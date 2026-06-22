# AGENTS.md - L Shopee Project Rules

These instructions apply to this project folder and override broader defaults when they are more specific.

## Project Intent

Build an admin back-office system for a Shopee seller that manages products, inventory, barcode-based on-site sales, pricing, financial records, and Shopee account synchronization.

## Development Rules

- Use TDD for application code once implementation begins.
- Keep documentation updated when requirements, data models, API contracts, or formulas change.
- Do not commit secrets, Shopee partner keys, access tokens, refresh tokens, cookies, or exported customer data.
- Treat local inventory records as financial data. Preserve auditability for stock changes, sale records, refunds, and manual adjustments.
- Verify Shopee Open Platform endpoint behavior against official docs and the developer console before implementing or changing API integrations.
- Keep API-specific code isolated behind a Shopee integration module so business logic can be tested without live API calls.
- Add tests for all pricing, tax, commission, and profit formulas before changing them.
- Add tests for stock ledger behavior before changing inventory logic.
- Prefer explicit currency, tax, and rounding rules over implicit defaults.

## Expected Project Shape

If the user confirms a TypeScript web stack, prefer:

- `apps/admin` for the admin web interface.
- `apps/api` for backend API and Shopee integration jobs.
- `packages/db` for database schema and migrations.
- `packages/core` for pricing, inventory, and terms-generation logic.
- `docs` for requirements and implementation notes.

Do not create this code structure until the user confirms the stack.

## Verification Expectations

Before reporting implementation work as done:

- Run relevant tests.
- Run typecheck/lint when available.
- Verify important user workflows manually or with browser tests.
- Report any command that could not be run.

## GitHub Rules

- Do not force-push.
- Do not rewrite user-owned history.
- Do not create a public repository unless the user explicitly approves public visibility.
- Confirm the exact GitHub repository name before pushing because the user provided a profile URL, not a repository URL.
