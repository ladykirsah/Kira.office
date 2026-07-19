-- Adds the engine air-filter category (กรองอากาศ) with a stable id, mirroring the 0005 seed
-- style, so storefront content (FAQ answers) can deep-link the category without depending on an
-- admin-created UUID.
INSERT INTO `product_types` (`id`, `name`, `sort_order`, `created_at`) VALUES
	('pt-air-filter', 'Air filter', 6, 0);
