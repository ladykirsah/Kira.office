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
| Product owner and name | **Formula L** (the owner's company) owns the product, renamed **TeamPit / ทีมพิท** (was CrewEngine, Kira.office before that). **Den Air Service** (family business, VAT-registered for a long time) is its first user. TeamPit is a full-service system sold as **subscription plans**, including plans for small businesses and companies that need VAT billing (owner, 2026-11-17). |
| VAT billing in TeamPit | **The easiest way** (owner, 2026-11-17: *"yes, go with the easiest way"*): VAT on the bill + **full tax invoices** (ใบกำกับภาษีเต็มรูป), each shop issuing under its own name and tax ID, findable, printable and shareable by month. **No short tax invoices** (*"don't want"*) and **no VAT report files**, so Formula L registers nothing (a computer-made full tax invoice needs no approval, RD ruling กค 0811/พ.5106; the software-house number is only for software that makes the Section 87 reports). Each shop files its own VAT/tax with its accountant or accounting app. Report files can come later, after Formula L gets a software-house number. Not tax advice: confirm with the Revenue Department (1161) or an accountant. |
| Repair job (งานซ่อม), plan 10.1 | Owner, 2026-11-17. Steps เข้าใหม่ → ตรวจเช็ค → ประเมินราคา → ลูกค้าตกลงราคา → รออะไหล่ (only while a part is missing) / กำลังซ่อม → พร้อมรับรถ (bill issued to pay) → ชำระเงินแล้ว; back to any step; every move kept with who and when; cancel needs a reason; never deleted. **Pick A:** parts taken for a job move ขายได้ → งานนอก and are sold when the customer pays; cancel brings them back; money counts only when paid. Waiting parts carry a date AND time; a brand-new part may be typed by name on a job and linked to its product before the wait ends. Job number `JB…` from the server, also the job's bill number. Details: [repair-jobs](knowledge/commerce/repair-jobs.md). |
| VAT billing, plan 10.2 | Owner, 2026-11-17: VAT billing is for the big subscription plan (company-registered shops selling to B2C and B2B). **B2C → cash bill; B2B → cash bill or tax invoice, picked per sale**; a company's details are saved in a book for later or recorded on the spot (global practice: PEAK, FlowAccount). Until plans exist it is a per-shop switch (never set = on for Den Air). While on, VAT is on every line including labour, worked out by the server. Tax invoices and credit notes get server-made running numbers (TI…/CN… by the Thai month), are never deleted, are cancelled with a reason by the super admin and issued again; a refund of an invoiced bill makes a credit note. The month's list (+ CSV) is a plain list, not the RD report form. Details: [vat-billing](knowledge/commerce/vat-billing.md). |
| Each shop's own space, plan 10.3 | Owner, 2026-11-17, pick **A**: each shop has its own web address; staff open it and type their PIN, as today. Built as **one database per shop** (Cloudflare's per-tenant pattern; global practice checked: Square/Loyverse, Shopify/Slack, FlowAccount). Den Air stays exactly where it is (no live database change); Den Air + AirPlus remain one shop sharing stock; a new shop starts with the standard lists, its owner is its first account with the owner lock, and new shops are made by Formula L (`scripts/new-shop.mjs`), no sign-up page yet. Details: [shop-space](knowledge/platform/shop-space.md). |
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
| Flash sale on a cancelled or expired order | **The buyer loses the flash price; the unit goes back to the sale** (owner, 2026-11-16: *"Flash-sale is discount on specific period. buy during the period > get discount, cancel > lose … learn from global practice"*). As on Shopee and Lazada, a cancelled or expired order gives its flash-sale slot back (`campaign_prices.sold_count` down) so the next buyer can still get it while the sale runs. Each order line records its flash-sale price (`sales_order_lines.campaign_price_id`, migration 0102); lines from before 0102 give nothing back. |
| Coupon on an expired unpaid order | **Given back, unless the coupon has ended by then** (owner, 2026-11-16: *"yes, if it happen after the coupon expire > it never comes back"*). A shop cancel always gives it back. |
| Which coupons the website lists | **Only coupons with แสดงบนเว็บ on** (owner's pick A, 2026-11-17: *"Yes, go with A"*). The switch is on CrewEngine's coupon form and off for every coupon until the owner turns it on; off = code only, so a code handed to one person stays private (like Shopee's shop-page vouchers vs code-only ones). ลูกค้าใหม่ coupons land on My coupons instead. Migration 0104. |
| Bank transfer orders | **Each โอนเข้าบัญชีร้าน order keeps the bank account it was told to pay into** (plan 8.7, agreed 2026-11-16). One account per shop on ข้อมูลร้าน → บัญชีธนาคาร, kept apart from the PromptPay list so no QR is ever made from it. The website shows it with the payment pages' redesign (board 6). |

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
| Staff PIN guessing | **6 wrong PINs is the most, across the whole shop** (owner, 2026-11-16: *"6 wrong is max"*). After six wrong PINs in a row, from any address, PIN sign-in pauses for everyone until the 15-minute window ends. Email + password and the emergency key stay open. Accepted trade-off: a stranger can pause PIN sign-in. Details: [staff-login-and-lockout](knowledge/auth/staff-login-and-lockout.md). |
| Monorepo | **npm workspaces**; **Node 22** (Wrangler requires ≥22; pinned via `.nvmrc` + CI), no pnpm |
| Core logic package | `packages/core` — pure TypeScript, framework-free, **TDD-first** |
| Tests | **Vitest**; browser tests for critical flows later |
| Barcode input | USB scanner (keyboard emulation) as baseline; camera + manual entry as fallback |

## Repository

| Topic | Decision |
| --- | --- |
| Name | `Kira.office` (npm workspace root id: `kira-office`) |
| App name on screen | **CrewEngine** (owner, 2026-10-29). Logo: an orange line drawing of a turbo housing on navy (concept C). The name is plain one-colour text lettered in **Space Grotesk 600**; only the name uses that font. Replaces "Kira.office" everywhere a person reads it. Hidden ids keep the old spelling on purpose: the repo, the `kiraoffice` Worker, the `kira-office` D1, the `kira_staff` cookie (renaming signs everyone out) and the `kira-pos` offline store (renaming can strand unsynced sales). Guarded by `apps/admin/src/lib/appName.test.ts`. |
| Visibility | **Private** |
| Owner / status | **Published** at [`ladykirsah/Kira.office`](https://github.com/ladykirsah/Kira.office) (private). See [GITHUB_CHECKLIST.md](GITHUB_CHECKLIST.md). |

## Items marked _Assumption_

These were defaulted to keep momentum and are safe to change. Confirm when convenient:
variant axes · single vs multiple locations · on-site payment methods · receipt printing ·
historical-import window · which Shopee order statuses reduce stock.
