-- Customer credit + tier system for automatic COD approval gating.
--
-- credit_score is a running tally: +1 per completed order, -1 per incomplete order (48h expired
-- unpaid or COD denied). Product-failure returns do NOT count. All existing customers start at 0
-- (good standing).
--
-- tier is the cached effective tier, recalculated on every order event so admin list queries don't
-- need to aggregate orders just to show it. Values: best, good, watch, bad, block.
--
-- tier_locked_until is set when a customer enters "bad" — COD is blocked until this timestamp plus
-- 2 completed prepaid orders. NULL = not locked.
--
-- tier_override + tier_override_reason let an admin force "block" (or any tier) regardless of the
-- computed value. NULL = computed from credit + loyalty.

ALTER TABLE storefront_customers ADD COLUMN credit_score integer NOT NULL DEFAULT 0;
ALTER TABLE storefront_customers ADD COLUMN tier text NOT NULL DEFAULT 'good';
ALTER TABLE storefront_customers ADD COLUMN tier_locked_until integer;
ALTER TABLE storefront_customers ADD COLUMN tier_override text;
ALTER TABLE storefront_customers ADD COLUMN tier_override_reason text;
