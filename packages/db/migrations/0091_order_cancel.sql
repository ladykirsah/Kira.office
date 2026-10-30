-- The shop cancelling an AirPlus order (owner's decision, 2026-10-30).
--
-- cancel_reason decides the customer's credit: 'customer_request' counts against them whether they
-- paid or not; the shop's own reasons ('out_of_stock', 'other') never do. NULL = an older cancel
-- (or the customer's own COD-refused cancel), which keeps the original credit rule.
--
-- cancelled_at is the moment of the cancel. The cancel is ONE D1 batch (status, stock back, coupon
-- back, timeline): every later statement in that batch is guarded on cancelled_at equalling this
-- cancel's own timestamp, so if the drop-off form won the race and the guarded UPDATE changed
-- nothing, nothing else in the batch runs either. It also anchors the refund window for a paid
-- order that was cancelled.
--
-- Plain additive columns: every existing row stays as it is (both NULL).
ALTER TABLE sales_orders ADD COLUMN cancel_reason TEXT
  CHECK (cancel_reason IS NULL OR cancel_reason IN ('customer_request', 'out_of_stock', 'other'));
ALTER TABLE sales_orders ADD COLUMN cancelled_at INTEGER;
