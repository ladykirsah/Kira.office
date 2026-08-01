-- Claim replacement address (owner, 1 Aug 2026).
--
-- When a customer files a defect claim they pick the outcome: money back, or a REPLACEMENT. For a
-- replacement they choose the same delivery address or a new one. The chosen address for the
-- replacement lives here: NULL means "ship to the order's original shipping_address_id"; non-null
-- points at a fresh addresses row the customer filled in on the claim form.
--
-- The refund outcome reuses the order-level refund fields (sales_orders.refund_*, migration 0076);
-- resolution ('exchange' | 'refund') and the claim's own carrier/tracking_no already exist (0071).
ALTER TABLE `order_claims` ADD COLUMN `replacement_address_id` text REFERENCES `addresses`(`id`);
