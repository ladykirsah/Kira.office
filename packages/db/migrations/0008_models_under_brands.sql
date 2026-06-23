-- Car models now belong to a car brand (one brand → many models). Uniqueness becomes per-brand.
ALTER TABLE `car_models` ADD COLUMN `car_brand_id` text;
DROP INDEX `car_models_name_uq`;
CREATE UNIQUE INDEX `car_models_brand_name_uq` ON `car_models` (`car_brand_id`, `name` COLLATE NOCASE);
CREATE INDEX `car_models_brand_idx` ON `car_models` (`car_brand_id`);
-- Re-home the seeded flat models under their brands + add Vigo (Toyota) from the example.
UPDATE `car_models` SET `car_brand_id` = 'cb-toyota' WHERE `id` IN ('cm-vios', 'cm-yaris');
UPDATE `car_models` SET `car_brand_id` = 'cb-honda' WHERE `id` = 'cm-city';
UPDATE `car_models` SET `car_brand_id` = 'cb-mitsubishi' WHERE `id` IN ('cm-triton', 'cm-pajero');
INSERT INTO `car_models` (`id`, `name`, `sort_order`, `created_at`, `car_brand_id`)
	VALUES ('cm-vigo', 'Vigo', 0, 0, 'cb-toyota');
