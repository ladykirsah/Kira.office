-- A ceiling on what one coupon may ever discount, in satang. NULL = uncapped (every existing row).
--
-- Percent coupons are the reason: "10% off" is fine on a ฿500 filter and ruinous on a ฿30,000
-- compressor, where it hands back ฿3,000 — often the whole margin. The cap bounds the loss without
-- having to advertise a smaller percentage. It applies to fixed coupons too, so one rule covers both.
ALTER TABLE coupons ADD COLUMN max_discount_satang integer;
