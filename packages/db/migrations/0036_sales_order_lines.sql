-- Line items for marketplace orders (sales_orders was a totals-only header row until now).
-- Needed for AirPlus's storefront checkout, which creates a real order with real product lines
-- (unlike CSV-imported Shopee orders, which stay header-only for now). Models onsite_sale_lines'
-- shape/convention (product + qty + price + cost snapshot + line total).
CREATE TABLE sales_order_lines (
  id text PRIMARY KEY NOT NULL,
  sales_order_id text NOT NULL REFERENCES sales_orders(id),
  product_variant_id text NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL,
  unit_price_satang integer NOT NULL,
  unit_cost_satang integer NOT NULL DEFAULT 0, -- cost snapshot at sale time
  line_total_satang integer NOT NULL,
  created_at integer NOT NULL
);
CREATE INDEX sales_order_lines_order_idx ON sales_order_lines (sales_order_id);
