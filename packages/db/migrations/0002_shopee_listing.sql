-- Shopee listing status + online price, for the Seller-Centre-style product table.
ALTER TABLE products ADD COLUMN shopee_listed integer DEFAULT 0 NOT NULL;
ALTER TABLE pricing_profiles ADD COLUMN online_price_satang integer DEFAULT 0 NOT NULL;
