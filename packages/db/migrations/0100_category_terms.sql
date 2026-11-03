-- A category's เงื่อนไข (owner, 3 Nov 2026): "the conditions is set based on product type as the
-- description we have just worked on", kept with its description under เกี่ยวกับสินค้าประเภทนี้.
--
-- The text AirPlus shows in a เงื่อนไข box on each of the category's products, with that product's
-- {{product_name}}, {{brand}} and the category's {{warranty}} filled in (packages/core categoryTerms).
-- Optional: NULL = the category has none, and its products show no เงื่อนไข box.
ALTER TABLE `product_types` ADD COLUMN `terms` text;
