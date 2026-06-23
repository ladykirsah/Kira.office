-- Pricing model: B2B on-site price, online Shopee commission, and a per-product tax-on-cost flag.
-- (Campaign pricing is a client-side workspace and is intentionally not persisted.)
ALTER TABLE `pricing_profiles` ADD COLUMN `b2b_price_satang` integer DEFAULT 0 NOT NULL;
ALTER TABLE `pricing_profiles` ADD COLUMN `online_commission_bp` integer DEFAULT 0 NOT NULL;
ALTER TABLE `pricing_profiles` ADD COLUMN `tax_on_cost` integer DEFAULT 0 NOT NULL;
