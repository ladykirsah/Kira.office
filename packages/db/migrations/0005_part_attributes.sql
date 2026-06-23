-- Part attributes: managed lists behind the product dropdowns (brand / car system / part name).
-- products already reference these via brand_id / type_id / usage_id.
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `product_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `usage_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `brands_name_uq` ON `brands` (`name` COLLATE NOCASE);
CREATE UNIQUE INDEX `product_types_name_uq` ON `product_types` (`name` COLLATE NOCASE);
CREATE UNIQUE INDEX `usage_categories_name_uq` ON `usage_categories` (`name` COLLATE NOCASE);
-- Seed common car A/C values so the dropdowns are usable immediately.
INSERT INTO `brands` (`id`, `name`, `sort_order`, `created_at`) VALUES
	('br-denso', 'DENSO', 1, 0), ('br-mitsubishi', 'Mitsubishi', 2, 0),
	('br-sanden', 'Sanden', 3, 0), ('br-valeo', 'Valeo', 4, 0), ('br-mahle', 'Mahle', 5, 0);
INSERT INTO `usage_categories` (`id`, `name`, `sort_order`, `created_at`) VALUES
	('uc-ac', 'A/C', 1, 0), ('uc-engine', 'Engine', 2, 0),
	('uc-cooling', 'Cooling', 3, 0), ('uc-electrical', 'Electrical', 4, 0);
INSERT INTO `product_types` (`id`, `name`, `sort_order`, `created_at`) VALUES
	('pt-evaporator', 'Evaporator', 1, 0), ('pt-condenser', 'Condenser', 2, 0),
	('pt-compressor', 'Compressor', 3, 0), ('pt-expansion-valve', 'Expansion valve', 4, 0),
	('pt-receiver-drier', 'Receiver drier', 5, 0);
