# Open Questions

Status as of 2026-06-22. Authoritative answers live in [DECISIONS.md](DECISIONS.md).

## ✅ Resolved

| # | Question | Answer |
| --- | --- | --- |
| 1 | Shopee country/region | **Thailand** |
| 2/3 | Shopee account / Open Platform app | Seller account exists; **no API app yet**. TH API needs managed-seller status → API is a gated later phase; CSV bridge meanwhile. |
| 4 | Stack | **Next.js + TypeScript** |
| 5 | Offline on-site selling | **Yes — full offline-first POS** |
| 6 | Barcodes | **Most products already have barcodes**; generate internal only if missing |
| 7 | Currency / tax / fees | **THB**; **VAT 7% per-product inclusive/exclusive**; fees auto-suggested + adjustable % |
| 8 | T&Cs language | **Thai only** |
| 9 | Existing data | **Google Sheets** (partial) → importer required |
| 10 | First MVP priority | **All four pillars** (catalog · barcode/POS · Shopee sync · finance) |
| — | Cost method | Support **all four** (moving avg / latest / manual / FIFO), selectable |
| — | Profit rules | On-site = price−discount−tax−cost; **online adds Shopee fees** |
| — | Repo | `l-shopee-backoffice`, **private** |

## ⛔ Blocking

- **GitHub push target.** `gh` is authenticated as `janPhat` (org `mygogocash`); the requested
  owner `ladykirsah` is a separate user account that `janPhat` cannot push to. Choose a path in
  [GITHUB_CHECKLIST.md](GITHUB_CHECKLIST.md) before publishing.

## ◻️ Minor — defaulted, confirm when convenient

These were defaulted (see DECISIONS.md → "Items marked Assumption") so work could proceed:

- 14–16. Exact product **types / brands / usage** categories to seed.
- 17. Exact **variant axes** (size / color / scent / pack?).
- 33. On-site **payment methods** beyond Cash + PromptPay (card?).
- 34. **Receipt printing** needed for MVP?
- 35. **One location or multiple?** (schema is multi-location-ready.)
- 36. Staff allowed to **override price** (currently owner-only) — confirm.
- 37–38. **Historical** Shopee import window (defaulted 90 days).
- 39. Which Shopee **order statuses reduce stock** (defaulted Ready-to-ship/Paid).
- 26–28 detail. VAT-registered? Default tax-inclusive or -exclusive for new products?
- 32. Preferred **accountant export** format/software.
- 43. Any **deadline**?
