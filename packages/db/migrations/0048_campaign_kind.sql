-- Campaign KIND — owner decision (2026-07-14): the storefront shows two distinct discount surfaces,
-- and until now they could not be told apart (every discount was one time-windowed campaign, so the
-- home "flash sale" rail and the "สินค้าลดราคา" collection rendered the SAME products).
--
--   flash  = แฟลชเซล — urgent, countdown rail on home.
--   promo  = โปรโมชัน — an ongoing discount; feeds the "สินค้าลดราคา" collection (excludes flash).
--
-- Pricing is identical for both kinds (see packages/core resolveEffectivePrice) — `kind` only groups
-- them for display. Existing rows default to 'flash', preserving today's behaviour.
ALTER TABLE campaigns ADD COLUMN kind text NOT NULL DEFAULT 'flash' CHECK (kind IN ('flash', 'promo'));
