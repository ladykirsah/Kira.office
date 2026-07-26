-- Product categories become a subset of a car system: each product_type links to one usage_category
-- (its "car system"). The link is a plain nullable id column — app-enforced, matching how image_key
-- (0057) and name_th/name_en (0060) were added, and consistent with the free-text/id joins used across
-- the taxonomy. Existing categories (Evaporator, Condenser, Compressor, Expansion valve, Receiver
-- drier, Air filter) are all A/C parts, so backfill them to the A/C car system; new categories always
-- pick a system in the Add-new form.
ALTER TABLE `product_types` ADD COLUMN `usage_id` TEXT;

UPDATE `product_types`
   SET `usage_id` = (SELECT `id` FROM `usage_categories` WHERE `name` = 'A/C' COLLATE NOCASE)
 WHERE `usage_id` IS NULL;
