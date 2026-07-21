-- AirPlus customers become visible and manageable from Kira.office. Two additions, both nullable
-- and purely ADDITIVE (0041 explains why this table can never be rebuilt: incoming FKs from
-- `addresses`, `sales_orders` and `coupon_redemptions` make D1 roll a rebuild back).
--
-- `marketing_consent_at` — promotional LINE/SMS/email is a SEPARATE, withdrawable consent under
-- PDPA; the existing `pdpa_consent_at` covers only the privacy-notice + terms acceptance bundled
-- into registration, and cannot be reused to prove marketing opt-in. NULL = not opted in, which is
-- the correct default: consent is opt-in, never assumed. Nothing collects this from customers yet
-- — the storefront checkbox stays unbuilt until the live privacy notice discloses the purpose.
--
-- `anonymized_at` — when a PDPA erasure request was honoured. The row deliberately survives so the
-- customer's `sales_orders` (tax records the law requires us to retain) keep their FK; the identity
-- columns are blanked instead. `status` becomes 'anonymized' — no CHECK constraint exists on
-- `status`, so no constraint change is needed here.
ALTER TABLE storefront_customers ADD COLUMN marketing_consent_at integer;
ALTER TABLE storefront_customers ADD COLUMN anonymized_at integer;
