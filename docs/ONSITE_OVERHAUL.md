# On-site Overhaul — customer-service history, drafts & quotations

Branch: `claude/priceless-pascal-cca732` · PR [#4](https://github.com/ladykirsah/Kira.office/pull/4)
Status: **Phase 1 shipped** · **Phase 2 in progress** · 632 tests green

## Why

The car A/C shop runs its on-site (Den Air Service) work on Excel today. This overhaul moves it
into Kira, centered on **customer-service history** — tracking each car's repairs and purchases by
date and items, keyed by plate. Along the way it adds a proper draft/quotation lifecycle to the POS
and tidies the on-site Sales table.

## Locked decisions

- **Customer = one record per car plate.** `phone` is the grouping key — a family shares a phone
  across different plates, so search-by-phone finds all their cars.
- **Quotation → cash bill = a `stage` flip on the same `onsite_sales` row**, not a new sale engine.
  Finalizing reuses the existing `/sync` checkout — **one money/stock path**, never two.
- **Drafts are server-shared**: any POS device can reopen a parked cart. A draft/quotation is a
  **no-money document** (no stock, no ledger, no revenue) until it finalizes to a bill.
- **Quotation is a services/on-site convention, not a hard UI rule** — the POS UX stays flexible.
- **Reprint = re-render from stored lines** (no stored PDF), in the POS bill UI with only the
  Step-1 Setup (doc type / paper / language) adjustable.
- **Navigation:** `Sell → Point of Sale` (create) + `Sell → Customers` (find a car by plate/phone →
  its purchase & repair history + reprint). `Orders & money → Sales` stays the **finance dashboard**
  (numbers), with each bill row deep-linking into the customer's history.

## Shipped

### On-site Sales table redesign — `b713877`
Merged the Order-ID + Job columns into one identity cell (`[tag · car·plate] / [bill]`), renamed the
badges **Parts → Products** and **Repair → Service**, added `stripCarYear()` (show the model without
its year), reordered to **Job · Total · Profit · Date · Status · Action**, left-aligned the amounts,
and balanced the column widths. Unified every table's subtitle line to the one faint gray via a
shared `tableText` role helper.

### Phase 1 — draft / quotation lifecycle
| Commit | What |
| --- | --- |
| `24ff3ab` | `QT…` quotation number series, seeded independently of `DAS…` bills |
| `ad98182` | `onsite_sales.stage` (`draft`/`quotation`/`bill`) + revenue/stock/list guards so drafts & quotations never leak into totals, the Sales table, or the CSV |
| `ec6cc1d` | `/onsite/drafts` store API (no-money CRUD: create/list/delete) |
| `0b612de` | draft API client + pure cart↔draft mappers |
| `1959704` | POS UI — **Save draft** · **Save quotation** (mints QT) · **Open drafts** reopen tray · convert-on-checkout |

Verified end-to-end in the browser: save → list → reopen → delete.

### Phase 2 — customer history (in progress)
| Commit | What |
| --- | --- |
| `b7a165c` | `GET /onsite/sales/:id` — one bill with its lines (the shared reprint/history data source) |
| `6c59640` | `customers` table keyed by plate + `PUT /customers/by-plate` upsert (provided fields overwrite; omitted fields never blank an existing name/phone); `normalizePlate()` |

## Data model (new migrations)

- `0027_onsite_stage.sql` — `onsite_sales.stage TEXT NOT NULL DEFAULT 'bill' CHECK (draft|quotation|bill)`
- `0028_customers.sql` — `customers` (plate-unique, phone-indexed)

Pure stage rules live in `@l-shopee/core` `onsiteDoc` (`canConvert`, `countsAsRevenue`,
`deductsStock`, `numberPrefixFor`).

## API surface added

- `POST/GET/DELETE /onsite/drafts` — draft & quotation store (no money)
- `GET /onsite/sales/:id` — a bill + its lines (reprint / history)
- `PUT /customers/by-plate` — upsert a customer/car

## Remaining

- **Phase 2 C** — Customers page (Sell): search plate/phone → a car → purchase & repair history +
  reprint + editable name/phone.
- **Phase 2 D** — wire-up: Sales rows deep-link to a bill in the customer history; POS upserts the
  customer on checkout; optional name/phone fields at the POS.
- **Phase 3** — PromptPay: dynamic QR + manual "Paid" now (free), with a `PaymentConfirmer` seam for
  a later slip-verification / gateway auto-confirm.

## Ops / deploy

- Apply migrations **0020–0028** remotely on the next deploy:
  `wrangler d1 migrations apply kira-office --remote`. Until then the `stage` column and `customers`
  table don't exist in production. (Locally, the `stage` column and `customers` table were added
  directly to the dev D1 for verification, because the dev DB was seeded outside the migration
  tracker — do not run a full local `migrations apply`.)
- Unrelated red check: **"Workers Builds: kira-office"** fails at 0s for a Cloudflare account /
  integration reason (the GitHub Actions `build` job passes) — not a repo issue.
