CREATE TABLE `barcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_variant_id` text NOT NULL,
	`barcode_value` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_internal_generated` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barcodes_barcode_value_unique` ON `barcodes` (`barcode_value`);--> statement-breakpoint
CREATE TABLE `commission_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`channel` text DEFAULT 'shopee' NOT NULL,
	`commission_rate_bp` integer DEFAULT 0 NOT NULL,
	`transaction_fee_rate_bp` integer DEFAULT 0 NOT NULL,
	`service_fee_rate_bp` integer DEFAULT 0 NOT NULL,
	`fixed_fee_satang` integer DEFAULT 0 NOT NULL,
	`fee_base` text DEFAULT 'buyer_price' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cost_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`product_variant_id` text NOT NULL,
	`location_id` text,
	`received_qty` integer NOT NULL,
	`remaining_qty` integer NOT NULL,
	`unit_cost_satang` integer NOT NULL,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cost_layer_variant_idx` ON `cost_layers` (`product_variant_id`);--> statement-breakpoint
CREATE TABLE `financial_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`record_type` text NOT NULL,
	`channel` text NOT NULL,
	`amount_satang` integer NOT NULL,
	`tax_satang` integer DEFAULT 0 NOT NULL,
	`fee_satang` integer DEFAULT 0 NOT NULL,
	`cost_satang` integer DEFAULT 0 NOT NULL,
	`profit_satang` integer DEFAULT 0 NOT NULL,
	`occurred_at` integer NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `finance_channel_time_idx` ON `financial_records` (`channel`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `inventory_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`product_variant_id` text NOT NULL,
	`location_id` text,
	`stock_on_hand` integer DEFAULT 0 NOT NULL,
	`reserved_stock` integer DEFAULT 0 NOT NULL,
	`available_stock` integer DEFAULT 0 NOT NULL,
	`shopee_published_stock` integer,
	`reorder_threshold` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshot_variant_loc_uq` ON `inventory_snapshots` (`product_variant_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `onsite_sale_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`onsite_sale_id` text NOT NULL,
	`product_variant_id` text,
	`barcode_value` text,
	`quantity` integer NOT NULL,
	`unit_price_satang` integer NOT NULL,
	`discount_satang` integer DEFAULT 0 NOT NULL,
	`tax_satang` integer DEFAULT 0 NOT NULL,
	`unit_cost_satang` integer DEFAULT 0 NOT NULL,
	`cost_method_used` text,
	`gross_profit_satang` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`onsite_sale_id`) REFERENCES `onsite_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `onsite_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`client_uuid` text NOT NULL,
	`device_id` text,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`synced_at` integer,
	`sale_number` text,
	`cashier_user_id` text,
	`payment_method` text,
	`subtotal_satang` integer DEFAULT 0 NOT NULL,
	`discount_total_satang` integer DEFAULT 0 NOT NULL,
	`tax_total_satang` integer DEFAULT 0 NOT NULL,
	`grand_total_satang` integer DEFAULT 0 NOT NULL,
	`sale_status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cashier_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onsite_sales_client_uuid_unique` ON `onsite_sales` (`client_uuid`);--> statement-breakpoint
CREATE TABLE `pricing_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`product_variant_id` text NOT NULL,
	`item_cost_satang` integer DEFAULT 0 NOT NULL,
	`inbound_shipping_satang` integer DEFAULT 0 NOT NULL,
	`packaging_satang` integer DEFAULT 0 NOT NULL,
	`other_allocated_satang` integer DEFAULT 0 NOT NULL,
	`target_price_satang` integer DEFAULT 0 NOT NULL,
	`active_from` integer NOT NULL,
	`active_to` integer,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text,
	`variant_name` text,
	`barcode_primary` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `variant_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`product_code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type_id` text,
	`brand_id` text,
	`usage_id` text,
	`tax_profile_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tax_profile_id`) REFERENCES `tax_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_product_code_unique` ON `products` (`product_code`);--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`external_order_id` text NOT NULL,
	`order_status` text,
	`payment_status` text,
	`subtotal_satang` integer DEFAULT 0 NOT NULL,
	`discount_total_satang` integer DEFAULT 0 NOT NULL,
	`tax_total_satang` integer DEFAULT 0 NOT NULL,
	`fee_total_satang` integer DEFAULT 0 NOT NULL,
	`grand_total_satang` integer DEFAULT 0 NOT NULL,
	`order_created_at` integer,
	`imported_at` integer NOT NULL,
	`import_source` text DEFAULT 'csv' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_channel_external_uq` ON `sales_orders` (`channel`,`external_order_id`);--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`base_currency` text DEFAULT 'THB' NOT NULL,
	`timezone` text DEFAULT 'Asia/Bangkok' NOT NULL,
	`cost_method` text DEFAULT 'moving_average' NOT NULL,
	`default_vat_rate_bp` integer DEFAULT 700 NOT NULL,
	`vat_registered` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`product_variant_id` text NOT NULL,
	`location_id` text,
	`movement_type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`quantity_after` integer NOT NULL,
	`source_type` text,
	`source_id` text,
	`reason` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_variant_loc_idx` ON `stock_ledger_entries` (`product_variant_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`job_type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_retry_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`vat_rate_bp` integer DEFAULT 700 NOT NULL,
	`price_includes_vat` integer DEFAULT true NOT NULL,
	`is_taxable` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);