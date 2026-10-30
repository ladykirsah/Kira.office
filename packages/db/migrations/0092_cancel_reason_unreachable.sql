-- A 4th cancel reason: 'unreachable' (ติดต่อลูกค้าไม่ได้), owner's decision 2026-10-30. Like the
-- shop's other own reasons it costs the customer no credit point.
--
-- SQLite cannot change a CHECK in place, and rebuilding sales_orders (the core order table, with
-- many tables pointing at it) is far riskier than this. So the column is swapped:
--   1. add the new column with the widened CHECK,
--   2. copy every value across,
--   3. drop the old column (allowed: the only thing that names it is its own CHECK),
--   4. rename the new one into its place.
-- Nothing else references cancel_reason (no index, view or trigger), and every query reads it by
-- name, so its new position at the end of the table changes nothing.
ALTER TABLE sales_orders ADD COLUMN cancel_reason_new TEXT
  CHECK (cancel_reason_new IS NULL
         OR cancel_reason_new IN ('customer_request', 'out_of_stock', 'unreachable', 'other'));
UPDATE sales_orders SET cancel_reason_new = cancel_reason WHERE cancel_reason IS NOT NULL;
ALTER TABLE sales_orders DROP COLUMN cancel_reason;
ALTER TABLE sales_orders RENAME COLUMN cancel_reason_new TO cancel_reason;
