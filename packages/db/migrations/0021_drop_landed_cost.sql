-- Drop the never-wired landed-cost columns from pricing_profiles. They were defined
-- NOT NULL DEFAULT 0 but never read or written (profit is figured against item cost only), so
-- every row is 0 — removing them is a no-op on real data. Clears scaffolding that made the cost
-- base look fully-loaded (item + shipping + packaging) when it never was.
ALTER TABLE pricing_profiles DROP COLUMN inbound_shipping_satang;
ALTER TABLE pricing_profiles DROP COLUMN packaging_satang;
ALTER TABLE pricing_profiles DROP COLUMN other_allocated_satang;
