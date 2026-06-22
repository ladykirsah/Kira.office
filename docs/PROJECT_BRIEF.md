# Project Brief

## Working Name

L Shopee Back Office

## Problem

The seller needs one admin workspace to manage product data, product images, local stock, Shopee-linked stock numbers, barcode-based on-site selling, pricing, and financial records. Today these areas are likely split across Shopee Seller Centre, spreadsheets, manual notes, and on-site sales handling.

## Product Goal

Create a reliable back-office system that becomes the seller's source of truth for:

- Product master data.
- Product photos.
- Product categorization.
- Product terms and conditions.
- Stock quantity by channel and location.
- Shopee listing linkage.
- On-site barcode sales.
- Pricing, tax, commission, and profit.
- Online and on-site sales records.

## Primary Users

- Owner/admin: manages products, pricing, Shopee sync, and financial reports.
- Staff/operator: scans barcodes, adjusts stock, creates on-site sales, and uploads product photos.
- Accountant/bookkeeper, optional later: reviews sales and financial exports.

## Confirmed Scope

- Admin back office.
- Add and edit products.
- Upload product pictures.
- Categorize products by type, brand, and usage.
- Generate terms and conditions from reusable patterns.
- Manage product stock locally and sync stock numbers to Shopee.
- Scan barcodes for on-site stock movement and selling.
- Calculate price, tax, e-commerce commission, and profit.
- Track sales and finance records for Shopee online sales and on-site sales.

## Initial Assumptions

- "The number linked to my e-commerce account" means local stock quantity should be linked to Shopee listing/model stock.
- Shopee is the first e-commerce channel. Other channels can be added later if the data model keeps `sales_channel` flexible.
- The admin system should be web-based so it can run on a laptop/tablet and use a camera or USB barcode scanner.
- Local product records should be the canonical back-office source, while Shopee remains the sales channel.
- Generated product terms and conditions should be reviewed before publishing or attaching to a listing.

## Out Of Scope Until Confirmed

- Customer-facing storefront.
- Warehouse management beyond basic locations and stock ledger.
- Multi-branch inventory.
- Full accounting system.
- Automatic legal compliance review for terms and conditions.
- Live Shopee order fulfillment actions beyond order import and stock sync.

## Success Criteria

- Admin can create a product once with images, category, pricing, stock, barcode, and terms.
- Product can be linked to a Shopee item/model.
- Stock changes from on-site sales reduce local inventory and can update Shopee stock.
- Shopee online orders can be imported into the sales table.
- On-site sales can be recorded by scanning a barcode.
- Profit can be calculated per sale after cost, tax, and commission rules.
- Financial records can be filtered/exported by date, channel, product, and payment method.
