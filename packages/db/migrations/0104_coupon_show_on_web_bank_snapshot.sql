-- Plan 8.7 (owner, 17 Nov 2026: "Yes, go with A").

-- แสดงบนเว็บ: 1 = the coupon is on the AirPlus website's coupon list (storefront GET /api/coupons);
-- 0 = code only (a code handed to one person stays private). Off for every coupon until the owner
-- turns it on — the same idea as Shopee's vouchers shown on the shop page versus code-only ones.
ALTER TABLE coupons ADD COLUMN show_on_web integer NOT NULL DEFAULT 0 CHECK (show_on_web IN (0, 1));

-- The bank account a โอนเข้าบัญชีร้าน order was told to pay into, kept with the order (like
-- promptpay_id) so changing banks later never changes an old order:
-- JSON {"bank","accountName","accountNumber"}. NULL for PromptPay and for orders before 0104.
ALTER TABLE payments ADD COLUMN bank_account text;
