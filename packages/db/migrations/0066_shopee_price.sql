-- "AC on Sales" (the owner's Shopee shop) gets its own price column.
--
-- Until now a single online_price_satang served BOTH the AirPlus storefront and Shopee. The
-- storefront sells from online_price_satang, so that column stays with AirPlus and Shopee moves
-- here — nothing on the live shop changes price. There is no Shopee API, so this value is a
-- reference the owner keeps by hand; online_commission_bp (always the marketplace fee) belongs
-- with it.
ALTER TABLE pricing_profiles ADD COLUMN shopee_price_satang integer DEFAULT 0 NOT NULL;
