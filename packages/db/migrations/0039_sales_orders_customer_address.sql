-- Link an order to the storefront customer + shipping address who placed it (nullable — CSV-imported
-- Shopee orders will never have these; only orders created via the AirPlus storefront checkout will).
ALTER TABLE sales_orders ADD COLUMN storefront_customer_id text REFERENCES storefront_customers(id);
ALTER TABLE sales_orders ADD COLUMN shipping_address_id text REFERENCES addresses(id);
