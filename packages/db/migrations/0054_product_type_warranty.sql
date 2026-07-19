-- Warranty / return window PER PRODUCT CATEGORY (product_types). The Claim/Returns policy states the
-- period "varies by category and is shown on each product page" — this is the data behind that: a
-- number of DAYS, set once per category in the back office, displayed on every product of that type.
-- Nullable: a category with no warranty set simply shows no warranty row on the PDP (not "0 days").
ALTER TABLE `product_types` ADD COLUMN `warranty_days` integer;
