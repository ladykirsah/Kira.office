-- Fulfillment + profit fields on order rows. AirPlus (the owner's own single-seller site) surfaces
-- carrier + tracking and a real profit (own site, known costs, no commission → Sales = payout).
ALTER TABLE sales_orders ADD COLUMN carrier TEXT; -- shipping carrier (Flash, Kerry, ไปรษณีย์ไทย…)
ALTER TABLE sales_orders ADD COLUMN tracking_no TEXT; -- parcel tracking number
ALTER TABLE sales_orders ADD COLUMN profit_satang INTEGER; -- Sales − cost; null when unknown
