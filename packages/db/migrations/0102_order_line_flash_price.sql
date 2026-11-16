-- Which flash-sale price an AirPlus order line was bought at (owner, 16 Nov 2026). A flash sale is a
-- discount for its period: an order that is cancelled or expires loses it, and — as on Shopee and
-- Lazada — the unit goes back to the sale for the next buyer (campaign_prices.sold_count goes down).
-- NULL = bought at the normal price, and every line from before this column (nothing to give back).
-- Plain text, not a foreign key: removing a flash sale must never be blocked by old orders.
ALTER TABLE sales_order_lines ADD COLUMN campaign_price_id TEXT;
