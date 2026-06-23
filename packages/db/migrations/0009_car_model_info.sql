-- Per-model service notes: a customer-service cheat sheet for each car model (AC parts context).
-- All additive + nullable — existing rows and older code are unaffected.
ALTER TABLE `car_models` ADD COLUMN `generation_code` text;
ALTER TABLE `car_models` ADD COLUMN `year_from` integer;
ALTER TABLE `car_models` ADD COLUMN `year_to` integer;
ALTER TABLE `car_models` ADD COLUMN `refrigerant` text;
ALTER TABLE `car_models` ADD COLUMN `oring_size` text;
ALTER TABLE `car_models` ADD COLUMN `coolant_liters` text;
ALTER TABLE `car_models` ADD COLUMN `notes` text;
