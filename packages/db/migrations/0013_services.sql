-- Repair/labour services offered at the counter: a managed list (name + base price) that the POS
-- can add to a repair bill. Base price prefills on selection but is editable per sale.
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_price_satang` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `services_name_uq` ON `services` (`name` COLLATE NOCASE);
-- Seed common car-A/C services so the dropdown is usable immediately (prices in satang).
INSERT INTO `services` (`id`, `name`, `base_price_satang`, `sort_order`, `created_at`) VALUES
	('sv-ac-check', 'ตรวจเช็คระบบแอร์', 30000, 1, 0),
	('sv-ac-refill', 'เติมน้ำยาแอร์', 50000, 2, 0),
	('sv-ac-clean', 'ล้างตู้แอร์', 120000, 3, 0),
	('sv-compressor-labour', 'เปลี่ยนคอมเพรสเซอร์ (ค่าแรง)', 80000, 4, 0);
