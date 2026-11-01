-- Who made each coupon (owner, 1 Nov 2026: "please file it 'who create the coupon' from logged in
-- account"). Filled from the signed-in staff member when a coupon is created; coupons made before
-- this column existed stay NULL and the back office shows a dash for them.
ALTER TABLE coupons ADD COLUMN created_by_user_id text REFERENCES users(id);
