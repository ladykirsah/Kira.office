# Pricing And Finance

Region **Thailand**, currency **THB**, VAT **7%** (per-product inclusive/exclusive, configurable).
These formulas are implemented test-first in `packages/core` (`pricing` module). Changing them
requires updating the tests first.

## Goal

Make profit visible before a product is sold, and keep accurate records after each sale —
correctly distinguishing **on-site** (no marketplace fee) from **online/Shopee** (with fees).

## Core Inputs

- `unit_price`, `quantity`, `discount_amount` (in THB).
- Cost components: `item_cost`, `inbound_shipping_cost`, `packaging_cost`, `other_allocated_cost`.
- `cost_method`: `moving_average` | `latest` | `manual` | `fifo` (shop setting; default moving average).
- Tax: `vat_rate` (default 0.07), `price_includes_vat` (per product), or untaxed.
- Shopee fees (**online only**, adjustable): `commission_rate`, `transaction_fee_rate`,
  `service_fee_rate`, `fixed_fee`, and `fee_base` (default = buyer-facing price).
- `payment_method` (on-site); optional payment fee if a method charges one.

## Definitions

- **landed_cost** = `(item_cost + inbound_shipping_cost + packaging_cost + other_allocated_cost) × quantity`,
  where `item_cost` comes from the selected cost method (snapshotted at sale time).
- **gross** = `unit_price × quantity`
- **net_of_discount** = `gross − discount_amount`

## Tax (per product)

`sales_ex_tax` is the seller's revenue with VAT removed (VAT is remitted to the government, not
income). `buyer_price` is what the buyer actually pays for the item. These differ by whether the
listed price already contains VAT:

```text
if untaxed:
    tax_amount   = 0
    sales_ex_tax = net_of_discount
    buyer_price  = net_of_discount
else if price_includes_vat:                       # listed price already contains VAT
    tax_amount   = net_of_discount − net_of_discount / (1 + vat_rate)
    sales_ex_tax = net_of_discount − tax_amount    # = net_of_discount / (1 + vat_rate)
    buyer_price  = net_of_discount
else (price excludes vat):                        # VAT added on top at checkout
    tax_amount   = net_of_discount × vat_rate
    sales_ex_tax = net_of_discount
    buyer_price  = net_of_discount + tax_amount
```

## Marketplace Fees (online channel only)

```text
fee_base        = buyer_price               # configurable: buyer_price (default) | ex_tax
marketplace_fee = fee_base × commission_rate
               + fee_base × transaction_fee_rate
               + fee_base × service_fee_rate
               + fixed_fee
# On-site sales: marketplace_fee = 0
```

## Profit

```text
gross_profit       = sales_ex_tax − marketplace_fee − landed_cost
gross_margin_pct   = (sales_ex_tax == 0) ? 0 : gross_profit / sales_ex_tax × 100
```

- **On-site:** `marketplace_fee = 0` → `gross_profit = sales_ex_tax − landed_cost`.
- **Online (Shopee):** `gross_profit = sales_ex_tax − marketplace_fee − landed_cost`.

All amounts rounded to 2 decimals (THB) at the boundary; intermediate math kept full precision.

## Worked Example

Product priced **107 THB**, VAT 7% **inclusive**, qty 1, no discount, landed cost 60 THB.

- `tax_amount = 107 − 107/1.07 = 7.00`; `sales_ex_tax = 100.00`.
- On-site: `gross_profit = 100 − 60 = 40.00` (margin 40%).
- Online with commission 5% + transaction 2% + service 0% + fixed 2 THB, `fee_base = 107`:
  `marketplace_fee = 107×0.05 + 107×0.02 + 0 + 2 = 5.35 + 2.14 + 2 = 9.49`;
  `gross_profit = 100 − 9.49 − 60 = 30.51` (margin 30.51%).

## Online Shopee Sale Record

Preserve: Shopee order id; item/model id; local product/variant id; quantity; gross price;
discount; shipping (if available); commission and marketplace fees; tax; cost snapshot; profit
snapshot; order status; payment status.

## On-Site Sale Record

Preserve: sale number; cashier/staff user; product barcode scanned; quantity; unit price; discount;
tax; payment method; cost snapshot; profit snapshot; stock ledger reference; client-generated id
and sync status (offline-first).

## Financial Record Types

Sale revenue · discount · VAT collected · marketplace commission · payment fee · product cost ·
refund · cancellation · stock loss/write-off · manual adjustment.

## Required Views

Daily sales · sales by channel · sales by product · gross profit by product · fees by channel ·
VAT summary · on-site payment-method summary · export for accountant.

## Confirmed Rules vs Still-Open

Confirmed: THB; VAT 7% per-product inclusive/exclusive; all four cost methods; on-site excludes
marketplace fee; online includes Shopee fees; fees adjustable as %.

Still to confirm when relevant: exact Shopee commission/fee rates for this account; whether
shipping is pass-through/revenue/excluded from profit; handling of Shopee vouchers, platform
subsidies, seller discounts, and coin cashback; default `fee_base` (buyer price vs ex-tax).
