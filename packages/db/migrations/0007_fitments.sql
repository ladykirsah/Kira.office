-- Vehicle fitment: one part fits many cars. car_brands / car_models are managed creatable lists
-- (same pattern as the part attributes); product_fitments holds one row per compatible car.
CREATE TABLE `car_brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `car_models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `car_brands_name_uq` ON `car_brands` (`name` COLLATE NOCASE);
CREATE UNIQUE INDEX `car_models_name_uq` ON `car_models` (`name` COLLATE NOCASE);
CREATE TABLE `product_fitments` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`car_brand` text,
	`car_model` text,
	`year_from` integer,
	`year_to` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX `product_fitments_product_idx` ON `product_fitments` (`product_id`);
INSERT INTO `car_brands` (`id`,`name`,`sort_order`,`created_at`) VALUES
	('cb-toyota','Toyota',1,0),('cb-honda','Honda',2,0),('cb-mitsubishi','Mitsubishi',3,0),
	('cb-isuzu','Isuzu',4,0),('cb-nissan','Nissan',5,0);
INSERT INTO `car_models` (`id`,`name`,`sort_order`,`created_at`) VALUES
	('cm-vios','Vios',1,0),('cm-yaris','Yaris',2,0),('cm-city','City',3,0),
	('cm-triton','Triton',4,0),('cm-pajero','Pajero',5,0);
