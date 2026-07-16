# Project Brief

## Working Name

L Shopee Back Office

## Problem

A Shopee Thailand seller needs one admin workspace to manage product data, product images, local
stock, Shopee-linked stock numbers, barcode-based on-site selling, pricing, and financial records.
Today these are split across Shopee Seller Centre, Google Sheets, manual notes, and on-site sales
handling.

## Product Goal

A reliable back-office system that is the seller's source of truth for:

- Product master data, photos, and categorization (type / brand / usage).
- Thai product terms and conditions.
- Stock quantity by location, kept consistent across on-site and online channels.
- Shopee listing linkage (later, when API access is available).
- On-site barcode sales that work **offline**.
- Pricing in THB with cost, VAT, e-commerce commission, and profit.
- Online (Shopee) and on-site sales + financial records.

## Primary Users

- **Owner/admin:** products, pricing, Shopee linkage, financial reports, sensitive overrides.
- **Staff/operator:** scans barcodes, adjusts stock, creates on-site sales, uploads photos.
- **Accountant/bookkeeper** (optional, later): reviews and exports sales/financial records.
- **Customer/member (storefront):** browses and orders via the AirPlus storefront; registers/logs
  in by phone OTP with PDPA consent.

## Confirmed Scope

See [DECISIONS.md](DECISIONS.md) for the authoritative list. In short:

- Admin back office; add/edit products; upload + reorder pictures.
- Categorize by type, brand, usage; product variants.
- Generate Thai T&Cs from reusable patterns (review before publish).
- Manage stock locally; link/sync stock numbers to Shopee (later).
- Barcode-based **offline-first** on-site stock movement and selling.
- Pricing: cost, **per-product VAT (7%, inclusive/exclusive)**, Shopee commission, profit.
- Sales + finance records for Shopee online and on-site sales.

**Recently shipped:** AirPlus customer storefront (browse, PDP, cart, checkout, phone-OTP member
auth with PDPA consent, `/account` hub + orders/addresses/coupons wallet). See
[DECISIONS.md](DECISIONS.md) and [STATE_OF_THE_BUILD.md](STATE_OF_THE_BUILD.md).

## Key Assumptions

- "The number linked to my e-commerce account" = local stock quantity linked to Shopee
  listing/model stock.
- Shopee is the first e-commerce channel; the data model keeps `channel` flexible for others.
- Web-based so it runs on a laptop/tablet with a camera or USB barcode scanner.
- Local product records are the canonical back-office source; Shopee is a sales channel.
- Generated T&Cs are reviewed before publishing/attaching to a listing.
- On-site selling must keep working without internet (offline-first).

## Out Of Scope Until Confirmed

- Warehouse management beyond basic locations and a stock ledger.
- Full accounting system (we export for an accountant instead).
- Automatic legal compliance review of terms and conditions.
- Live Shopee order fulfillment (Shopee remains import + stock sync only; AirPlus-channel order
  fulfilment with a two-axis `order_status`/`payment_status` lifecycle is now in scope —
  `order_status`: new → preparing (เตรียมจัดส่ง) → shipping → done, + cancel/refund;
  `payment_status`: awaiting → paid, + COD).

## Success Criteria

- Create a product once with images, category, pricing, stock, barcode, and Thai terms.
- Record an on-site sale by scanning a barcode — **including with no internet** — and have it
  reduce local stock and post a financial record on sync.
- Compute profit per sale: on-site (cost/tax/discount) and online (plus Shopee fees).
- Import Shopee orders (CSV now, API later) into the sales table without duplicates.
- Filter/export financial records by date, channel, product, and payment method.
