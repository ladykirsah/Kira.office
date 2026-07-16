-- Link a payment approval to the storefront order it pays for (nullable — POS-recorded on-site
-- payments have no order row to link to; only storefront-checkout payments will set this).
ALTER TABLE payments ADD COLUMN sales_order_id text REFERENCES sales_orders(id);
