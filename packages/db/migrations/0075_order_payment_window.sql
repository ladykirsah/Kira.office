-- Resettable payment window (owner, 31 Jul 2026).
--
-- When an admin rejects a payment slip the order goes back to pending, and the owner wants the
-- customer to get a FRESH 48h to re-pay — not the remainder of the original window. We cannot reset
-- order_created_at for that (it is the real order date, shown on the page and used as the timeline's
-- first step), so the payment deadline gets its own nullable column. When set, it overrides the
-- default order_created_at + 48h in expireUnpaidOrders; null keeps the original behaviour.
ALTER TABLE sales_orders ADD COLUMN payment_expires_at INTEGER;
