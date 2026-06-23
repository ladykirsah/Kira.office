-- Product ID: the manufacturer/catalog reference that ships with some parts (e.g. "DI446610-1710").
-- Distinct from our internal product_code and from the Shopee item id.
ALTER TABLE `products` ADD COLUMN `product_ref` text;
