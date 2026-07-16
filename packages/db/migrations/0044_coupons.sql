-- Member-only coupon codes (the owner's chosen member-pricing mechanism; no self-serve B2B tier).
-- type 'fixed' → value is satang off; type 'percent' → value is basis points (10% = 1000).
CREATE TABLE coupons (
  id text PRIMARY KEY NOT NULL,
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('fixed', 'percent')),
  value integer NOT NULL CHECK (value > 0),
  min_subtotal_satang integer NOT NULL DEFAULT 0,
  starts_at integer,
  ends_at integer,
  max_uses integer,
  max_uses_per_customer integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at integer NOT NULL
);

CREATE TABLE coupon_redemptions (
  id text PRIMARY KEY NOT NULL,
  coupon_id text NOT NULL REFERENCES coupons(id),
  customer_id text NOT NULL REFERENCES storefront_customers(id),
  sales_order_id text NOT NULL REFERENCES sales_orders(id),
  amount_discounted_satang integer NOT NULL,
  created_at integer NOT NULL
);
CREATE UNIQUE INDEX coupon_redemptions_order_uq ON coupon_redemptions (coupon_id, sales_order_id);
CREATE INDEX coupon_redemptions_customer_idx ON coupon_redemptions (customer_id, coupon_id);
