-- Standardise AirPlus order + payment statuses from Thai free-text to English constants.
-- Shopee rows are untouched — their statuses come from CSV imports and are display-only.
--
-- Order status map:
--   ใหม่           → new
--   เตรียมจัดส่ง    → packing
--   กำลังจัดส่ง     → shipped
--   สำเร็จ          → delivered
--   ยกเลิก          → cancelled
--   คืนเงิน         → cancelled  (refund moves to payment_status)
--
-- Payment status map:
--   รอชำระเงิน       → pending
--   ชำระแล้ว         → paid
--   เก็บเงินปลายทาง  → cod

UPDATE sales_orders SET order_status = 'new'       WHERE channel = 'airplus' AND order_status = 'ใหม่';
UPDATE sales_orders SET order_status = 'packing'   WHERE channel = 'airplus' AND order_status = 'เตรียมจัดส่ง';
UPDATE sales_orders SET order_status = 'shipped'   WHERE channel = 'airplus' AND order_status = 'กำลังจัดส่ง';
UPDATE sales_orders SET order_status = 'delivered'  WHERE channel = 'airplus' AND order_status = 'สำเร็จ';
UPDATE sales_orders SET order_status = 'cancelled'  WHERE channel = 'airplus' AND order_status = 'ยกเลิก';

-- คืนเงิน was on order_status but is really a payment event; move it to payment_status.
UPDATE sales_orders SET order_status = 'cancelled', payment_status = 'refunded'
 WHERE channel = 'airplus' AND order_status = 'คืนเงิน';

UPDATE sales_orders SET payment_status = 'pending'  WHERE channel = 'airplus' AND payment_status = 'รอชำระเงิน';
UPDATE sales_orders SET payment_status = 'paid'     WHERE channel = 'airplus' AND payment_status = 'ชำระแล้ว';
UPDATE sales_orders SET payment_status = 'cod'      WHERE channel = 'airplus' AND payment_status = 'เก็บเงินปลายทาง';
