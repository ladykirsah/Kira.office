-- A car model is now a generation: the same name may exist once per era (year range).
-- Relax uniqueness from (brand, name) to (brand, name, year_from, year_to). year_from/year_to
-- already exist (migration 0009) and hold the model's era.
DROP INDEX `car_models_brand_name_uq`;
CREATE UNIQUE INDEX `car_models_brand_name_era_uq`
	ON `car_models` (`car_brand_id`, `name` COLLATE NOCASE, `year_from`, `year_to`);
