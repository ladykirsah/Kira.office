-- Failed-delivery refund (owner, 31 Jul 2026).
--
-- The ONE path that returns money inside the system: a parcel that bounced (order_status
-- 'delivery_failed', ตีกลับ) on an order whose money we actually hold. Every other return or claim is
-- handled off-system via LINE OA and touches none of this.
--
-- Flow: the customer opens their order on the AirPlus storefront and submits the bank account to
-- refund to; a super-admin sees it in the back office, transfers the FULL amount by hand within 2-3
-- business days, then records it here with the outgoing slip as evidence (shown back to the customer
-- on their order page). Unclaimed for over a year, we keep the money and it drops out of the queue.
--
-- refund_bank_name / refund_account_no / refund_account_name — the customer's payout account. This is
--   financial PII: the account fields are redacted from the order read model for anyone who is not a
--   super-admin, exactly like the payment slip.
-- refund_satang — the amount returned, set = grand_total_satang at refund time (always a full refund
--   for a failed delivery). Feeds orderMoney so a refunded order's profit reads as the shipping loss,
--   not the stale full margin.
-- refunded_at — ms; non-null is the "we have paid them back" marker that ends the action.
-- refund_actor_email — which super-admin recorded the refund.
-- refund_slip_image_key — R2 key of OUR outgoing transfer slip (namespace `refund-slip/`).
--
-- All nullable; null across the board = never refunded, which is every row that exists today. Added
-- at the end and never NOT NULL, so the storefront's positional INSERT stays valid.
ALTER TABLE `sales_orders` ADD COLUMN `refund_bank_name` text;
ALTER TABLE `sales_orders` ADD COLUMN `refund_account_no` text;
ALTER TABLE `sales_orders` ADD COLUMN `refund_account_name` text;
ALTER TABLE `sales_orders` ADD COLUMN `refund_satang` integer;
ALTER TABLE `sales_orders` ADD COLUMN `refunded_at` integer;
ALTER TABLE `sales_orders` ADD COLUMN `refund_actor_email` text;
ALTER TABLE `sales_orders` ADD COLUMN `refund_slip_image_key` text;
