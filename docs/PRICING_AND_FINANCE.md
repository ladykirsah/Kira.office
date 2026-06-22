# Pricing And Finance

## Goal

Make pricing and profit visible before a product is sold, and keep accurate records after each sale.

## Core Inputs

- Item cost.
- Inbound shipping cost.
- Packaging cost.
- Other allocated cost.
- Selling price.
- Discount.
- Tax rate.
- Shopee commission rate.
- Shopee transaction fee rate.
- Shopee service fee rate.
- Fixed fees.
- Payment method fee for on-site sales, if any.

## Draft Formulas

```text
landed_cost = item_cost + inbound_shipping_cost + packaging_cost + other_allocated_cost

tax_amount = taxable_base * tax_rate

ecommerce_fee = (selling_price * commission_rate)
              + (selling_price * transaction_fee_rate)
              + (selling_price * service_fee_rate)
              + fixed_fee

net_revenue = selling_price - discount_amount - tax_amount - ecommerce_fee

gross_profit = net_revenue - landed_cost

gross_margin_percent = gross_profit / selling_price * 100
```

These formulas must be adjusted once the seller's country, tax rules, Shopee fee structure, and tax-inclusive/tax-exclusive pricing are confirmed.

## Online Shopee Sale Record

Each imported Shopee sale should preserve:

- Shopee order id.
- Shopee item id and model id.
- Local product/variant id.
- Quantity.
- Gross sale price.
- Discount.
- Shipping amount if available.
- Commission and marketplace fees.
- Tax amount.
- Cost snapshot.
- Profit snapshot.
- Order status.
- Payment status.

## On-Site Sale Record

Each on-site sale should preserve:

- Sale number.
- Cashier/staff user.
- Product barcode scanned.
- Quantity.
- Unit price.
- Discount.
- Tax amount.
- Payment method.
- Cost snapshot.
- Profit snapshot.
- Stock ledger reference.

## Financial Record Types

- Sale revenue.
- Discount.
- Tax collected.
- Marketplace commission.
- Payment fee.
- Product cost.
- Refund.
- Cancellation.
- Stock loss/write-off.
- Manual adjustment.

## Required Views

- Daily sales.
- Sales by channel.
- Sales by product.
- Gross profit by product.
- Fees by channel.
- Tax summary.
- On-site payment method summary.
- Export for accountant.

## Open Decisions

- Currency.
- Seller country and tax type.
- Whether displayed prices include tax.
- Whether shipping is pass-through, revenue, or excluded from profit.
- How to handle Shopee vouchers, platform subsidies, seller discounts, and coin cashback if present.
- Whether profit should use average cost, latest cost, FIFO, or manual cost snapshot.
