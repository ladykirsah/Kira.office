---
type: feature
title: VAT billing — VAT on every line, the company book, tax invoices, credit notes
description: Plan 10.2 — B2C cash bill, B2B cash bill or full tax invoice picked per sale; company book; server-made TI/CN numbers; never deleted, cancelled with a reason; credit note on refund; the month's list + CSV
tags: [vat, tax-invoice, credit-note, pos, repair-job, shop-info]
timestamp: 2026-11-17
status: built (server + ข้อมูลร้าน; the counter's pick and the printed paper come with the design)
sources: [owner messages 17 Nov 2026, plan 10.2, PEAK and FlowAccount help centres]
---

# VAT billing

Plan 10.2 (owner, 17 Nov 2026), "the easiest way": VAT on the bill + full tax invoices only. No
short tax invoices and no Revenue Department report files, so Formula L registers nothing; shops
file through their accountant. Not tax advice — confirm with RD 1161 or an accountant.

## The owner's model (global practice: PEAK, FlowAccount)

- **B2C → cash bill. B2B → cash bill or tax invoice, picked per sale.** A company's details are
  kept in a book for next time, or typed on the spot and saved in the same step.
- VAT billing belongs to the big subscription plan. Plans don't exist yet, so for now it is a
  per-shop switch; gating it by plan comes with the plans.

## The switch and the shop's details (ข้อมูลร้าน › ภาษี, Den Air only for now)

- KV fields `vatBilling` (`on`/`off`; **never set = on** — Den Air is VAT-registered and its parts
  always carried VAT), `taxId` (13 digits, check digit verified, kept as digits), `taxBranch`
  (5 digits; blank = สำนักงานใหญ่ 00000), `taxName`, `taxAddress`. Checked on save
  (`shopTaxEditProblem`); the page checks first and says so under the box.
- **VAT on every line while on:** parts by their tax profile, labour at 7% inside the price too.
  Always worked out by the server — a VAT figure sent by a phone is ignored. Off: no VAT on any
  line. Old bills keep what they have. Labour's profit shows 7% less from then on.

## Papers (`tax_documents`, migration 0106)

- **Tax invoice** for a paid bill (counter or repair job): `POST /tax-invoices {saleId, buyerId |
  buyer}`. Number `TIyyyymm-nnnn` by the Thai month, made by the server; the date is the server's
  clock. Seller and buyer details and the amounts are kept on the paper as issued.
- Refused when: the switch is off; the shop's tax details are missing (named); not a paid bill;
  the bill already has a live one; **the first one is only on the bill's own day** (turning an old
  cash bill into a tax invoice later is not in 10.2).
- **Never deleted.** A mistake is cancelled with a reason (`POST /tax-documents/:id/cancel`, the
  super admin only, like refunds) and issued again — any day — naming the one it replaces.
- **Credit note (ใบลดหนี้):** refunding a bill with a live tax invoice writes `CNyyyymm-nnnn` for the
  whole bill in the same write (`refundSaleToDb`), with an optional reason. An invoice with a live
  credit note can't be cancelled.
- **The company book** (`tax_buyers`): one row per tax ID + branch; typing the same again updates
  it. `GET /tax-buyers?q=` finds by name or tax ID.

## The month's list for the accountant

`GET /tax-documents?month=YYYY-MM` (super admin, like การเงิน): every paper of the Thai month,
invoices then credit notes, cancelled ones marked; totals count live papers, credit notes take
away. `&format=csv` gives a CSV with a byte-order mark so Thai opens right in Excel. A plain list
of issued papers — not the Revenue Department's sales-tax report form.

## Not in 10.2

The counter's "which paper?" question and the printed tax invoice / credit note (come with the
design), AirPlus online orders, a tax invoice from an old cash bill, auto-fill of a company from
its tax ID.
