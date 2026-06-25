-- Repair orders: the on-site sale can now be a repair (with a car plate + notes) and carry
-- non-product service/labour lines alongside parts. Existing rows default to a parts sale.
ALTER TABLE `onsite_sales` ADD COLUMN `sale_type` text DEFAULT 'parts' NOT NULL;
ALTER TABLE `onsite_sales` ADD COLUMN `license_plate` text;
ALTER TABLE `onsite_sales` ADD COLUMN `notes` text;
ALTER TABLE `onsite_sale_lines` ADD COLUMN `line_type` text DEFAULT 'part' NOT NULL;
ALTER TABLE `onsite_sale_lines` ADD COLUMN `description` text;
