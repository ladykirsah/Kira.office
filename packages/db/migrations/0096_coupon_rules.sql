-- The coupon rules the owner asked for (1 Nov 2026): ส่งฟรี / ลดค่าส่ง, ลูกค้าใหม่, and ใช้กับ a brand,
-- a category, a car model or picked products. Existing coupons keep working as before: they cut
-- the products of the whole cart, for everyone.
--
-- applies_to: 'order' (the products) | 'shipping' (the fee; ส่งฟรี = percent 10000)
-- scope:      'all' | 'brand' | 'category' | 'car_model' | 'products' — app-enforced like the other
--             taxonomy links; the ids sit in coupon_targets.
-- signup_from / signup_to / valid_days: ลูกค้าใหม่ — accounts made in the window hold the coupon for
--             valid_days from the day the account was made, on any order. NULL = everyone.
ALTER TABLE coupons ADD COLUMN applies_to text NOT NULL DEFAULT 'order';
ALTER TABLE coupons ADD COLUMN scope text NOT NULL DEFAULT 'all';
ALTER TABLE coupons ADD COLUMN signup_from integer;
ALTER TABLE coupons ADD COLUMN signup_to integer;
ALTER TABLE coupons ADD COLUMN valid_days integer;

CREATE TABLE coupon_targets (
  coupon_id text NOT NULL REFERENCES coupons(id),
  target_id text NOT NULL,
  PRIMARY KEY (coupon_id, target_id)
);
