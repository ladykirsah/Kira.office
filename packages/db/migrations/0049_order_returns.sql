-- คืนสินค้า / เคลม — owner decision (2026-07-16): the storefront had NO way to cancel an order or
-- ask for a return, so a customer's only route was to find the LINE account and hope. Two additions:
--
-- 1. completed_at — the moment an order reached 'สำเร็จ'. The 7-day return window is measured from
--    it. It did not exist: ship_time_ms records when a TRACKING NUMBER was attached, which is when
--    the parcel left the shop, not when it landed. Rows written before this migration keep NULL, and
--    packages/core returnEligibility deliberately fails OPEN on NULL (a mechanic approves every
--    request anyway, so the cost of a wrongly-allowed request is one conversation).
--
-- 2. order_returns — one row per customer request. คืน (return) and เคลม (warranty claim) share the
--    table because they differ only in wording and in what the mechanic checks; both are gated on
--    the same approval. The request NEVER moves stock or money on its own — the shop decides, then
--    acts through the admin. That is why this table has no amount column: refunds stay in
--    sales_orders / payments where the money already lives, and nothing here can silently pay out.
ALTER TABLE sales_orders ADD COLUMN completed_at integer;

CREATE TABLE order_returns (
  id text PRIMARY KEY NOT NULL,
  sales_order_id text NOT NULL REFERENCES sales_orders(id),
  -- 'return' = ส่งของคืน, 'claim' = เคลมประกัน. Same approval path, different mechanic checklist.
  kind text NOT NULL CHECK (kind IN ('return', 'claim')),
  -- Thai reason chosen from a fixed list in the UI; free text goes in `note` so the list stays clean.
  reason text NOT NULL,
  note text,
  -- Customer lifecycle. 'รอตรวจสอบ' until the mechanic looks; 'เสร็จสิ้น' once acted on.
  status text NOT NULL DEFAULT 'รอตรวจสอบ' CHECK (status IN ('รอตรวจสอบ', 'อนุมัติ', 'ปฏิเสธ', 'เสร็จสิ้น')),
  -- The shop's answer, shown to the customer verbatim — so a rejection is never silent.
  decision_note text,
  decided_at integer,
  created_at integer NOT NULL
);

-- The storefront reads "does this order have an open request?" on every order-detail render, and
-- writes are gated on it, so this lookup must not scan.
CREATE INDEX idx_order_returns_order ON order_returns(sales_order_id, status);
