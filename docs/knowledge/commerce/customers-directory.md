---
type: feature
title: Customers directory — plate-keyed model, legacy history, Excel import
description: One record per car plate (phone = grouping key); legacy service history is memory-not-money; Excel importer does atomic NULL-safe upserts
tags: [customers, pos, import, plate, history, excel]
timestamp: 2026-08-09
status: live
sources: [onsite-pos-customer-roadmap.md]
---

# Customers directory

## Customer model is PLATE-keyed, not person→cars

Owner decision 2026-07-03: store plate (+ province), owner name, phone; **phone is a first-class search field**. A family sharing a phone with different plates = separate plate records (accepted). Reason: "dad brings car A, son brings car B — plate and phone are what matter." Search plate → that one car; search phone → all that person's/family's cars.

- The `customers` table is keyed by **normalized plate** (`normalizePlate` in `packages/core`); name/phone are OPTIONAL at POS and editable on the customer page (plate rows auto-created from sales).
- Multiple phones share the existing `customers.phone` column comma-separated via `apps/admin/src/lib/phones` (no migration).
- Finding a past bill happens THROUGH the customer/car (Sell > Customers), not a flat list; the Sales page stays the cross-channel FINANCE dashboard (numbers only) — see [money-model-and-finance](money-model-and-finance.md).

## Legacy service history is MEMORY NOT MONEY

The owner explicitly rejected back-dating old bills through the POS (verified: the POS date field only prints; `created_at` is server-now; back-dating would corrupt stock + revenue). Instead:

- Table `customer_history_entries` (migration 0033, prod; `UNIQUE(plate,happened_at,description)` → idempotent `INSERT OR IGNORE` re-imports) via `POST /import/customer-history`. It never touches stock, revenue, or bill numbering.
- Migration 0035 added `note` + `lines_json` (additive/nullable; old text-only entries fall back to splitting description by newline).
- `parseThaiDateMs` converts Buddhist-era Thai dates (Bangkok tz) with a round-trip check that rejects impossible days — **`Date.parse` silently ROLLS Apr 31→May 1**.
- Import counters are truthful from D1 `meta.changes` (OR-IGNORE-suppressed rows must not count as imported).
- The car timeline merges bills + legacy rows: `LegacyRow` renders like a bill (date + "No bill ID" mono + line items with productRef + "Note — …") but **NO total and NO reprint** — distinguishing memory from a real bill.

Owner workflow: they transcribe per-car legacy sheets into Google Sheets; the final format is the GROUPED BILL-STYLE "rich" sheet parsed by `parseRichSheet`/`looksLikeRichSheet` in `packages/core/src/customerImport.ts`. Traps: หมายเหตุ (note) appears **TWICE** (customer note vs bill note) so the parser MUST read by colour GROUP, not header name; blank ทะเบียน (plate) = same car; blank วันที่ (date) = same visit. Owner's real sheet is titled **"Import Customers to Kira"** — locate it by title via Drive search / the Google Drive MCP (the file id is deliberately not committed here: the sheet holds real customers' PII); the sheet stays Thai (the owner does NOT want it translated — map in code). Flow: owner fills sheet → says "import now" → assistant pulls it via Google Drive MCP (`download_file_content`, exportMimeType text/csv) and loads PROD.

## Customers Excel importer (PR #8, claude/customers-importer)

Customers page "Import Excel…": in-browser parse (core `xlsxToRows` generic grid + `rowsToCsv`; .csv via `parseCsv`) → `guessCustomerMapping` auto-detects Thai/Eng headers (prefix-beats-contains; a header is claimed once; loosest synonyms last) with correctable per-field selects + 5-row preview → `POST /import/customers` = **atomic batch of ON CONFLICT/COALESCE upserts keyed by `normalizePlate`**.

Critical semantics:
- **EMPTY CELLS → NULL, so an import never blanks existing hand-typed data.** But non-empty import values DO overwrite hand edits — known trade-off.
- In-file repeats: first-wins. Existing-plate lookup chunked ≤90 binds under D1's 100-parameter cap.
- `searchCustomers` was REWRITTEN to directory ∪ billed plates, so imported customers appear with `billCount 0` / `lastVisitAt null` BEFORE their first bill.
- Excel number-cells lose leading zeros — phone columns must be Plain-text formatted; the preview exposes it. List LIMIT 100.
- If auto-detect misses new headers, extend `SYNONYMS` in `packages/core/src/customerImport.ts`.

Same PR fixed the admin `/api/worker` proxy forwarding stale `content-encoding`/`content-length` after `fetch()` decompression, which made EVERY proxied response fail `ERR_CONTENT_DECODING_FAILED` — `workerProxyResponseHeaders` (TDD) strips them and also protects the deployed OpenNext admin (see [platform](../platform/index.md)).

## References

- PR #8, PR #14; migrations 0033, 0035
- `packages/core/src/customerImport.ts`, `packages/core/src/xlsx.ts`, `normalizePlate`
- `apps/admin/src/lib/phones`
- Related: [customer-credit](customer-credit.md) (AirPlus storefront customers are a separate credit-scored population)
