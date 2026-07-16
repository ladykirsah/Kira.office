-- Shipping addresses for storefront customers. No such table existed anywhere before this — the
-- only prior "address" fields were the shop's OWN address (shop_info), unrelated to a customer's
-- shipping destination.
CREATE TABLE addresses (
  id text PRIMARY KEY NOT NULL,
  storefront_customer_id text NOT NULL REFERENCES storefront_customers(id),
  recipient_name text NOT NULL,
  phone text NOT NULL,
  address_line1 text NOT NULL,
  subdistrict text NOT NULL,
  district text NOT NULL,
  province text NOT NULL,
  postal_code text NOT NULL,
  is_default integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL
);
CREATE INDEX addresses_customer_idx ON addresses (storefront_customer_id);
