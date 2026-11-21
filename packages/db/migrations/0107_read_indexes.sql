-- Plan 13.1 (owner, 21 Nov 2026: "now, first"): fewer rows read. Cloudflare's query list for the 7 days
-- to 21 Nov showed the product list reading the whole price table for every latest-price lookup (no
-- index on product_variant_id), and the car lists scanning every fitment for each car. Indexes only:
-- no data changes, safe to apply before the code that leans on them.
CREATE INDEX IF NOT EXISTS pricing_profiles_variant_idx ON pricing_profiles (product_variant_id, active_from);
CREATE INDEX IF NOT EXISTS product_fitments_car_idx ON product_fitments (car_brand, car_model);
