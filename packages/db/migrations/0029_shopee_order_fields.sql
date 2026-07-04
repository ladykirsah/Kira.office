-- Extra fields captured from the Shopee Seller Centre order export, surfaced on the Sales → Shopee
-- table. grand_total_satang already holds the seller payout (จำนวนเงินทั้งหมด); fee_total_satang holds
-- the total Shopee fees (commission + transaction + service).
ALTER TABLE sales_orders ADD COLUMN buyer_username TEXT; -- ชื่อผู้ใช้ (ผู้ซื้อ)
ALTER TABLE sales_orders ADD COLUMN sales_satang INTEGER DEFAULT 0 NOT NULL; -- ราคาสินค้าที่ชำระโดยผู้ซื้อ
ALTER TABLE sales_orders ADD COLUMN fee_bp INTEGER DEFAULT 0 NOT NULL; -- ค่าธรรมเนียม (%) as basis points, 3.21% = 321
ALTER TABLE sales_orders ADD COLUMN ship_time_ms INTEGER; -- เวลาส่งสินค้า
