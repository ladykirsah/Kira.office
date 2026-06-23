-- Product editor: image gallery (up to 10), Shopee link id, own category, weight.
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`image_key` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_cover` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);
ALTER TABLE `products` ADD COLUMN `shopee_item_id` text;
ALTER TABLE `products` ADD COLUMN `category` text;
ALTER TABLE `products` ADD COLUMN `weight_grams` integer DEFAULT 0 NOT NULL;
