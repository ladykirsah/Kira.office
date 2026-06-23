-- Track when a product was last edited, for a "Last updated" display.
-- Additive; backfill existing rows from created_at so they show a sensible value.
ALTER TABLE `products` ADD COLUMN `updated_at` integer;
UPDATE `products` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
