-- Drop the unused Shopee listing-sync scaffolding (shopee_listings + shopee_listing_models). It was
-- infrastructure for the future live v2 API's per-listing / per-variant stock sync, but nothing ever
-- referenced it — today's Shopee link is the flat products.shopee_item_id + shopee_listed. When the
-- v2 API is built, the sync tables get designed to match its actual shape. shop_connections (the
-- OAuth store) is kept. Drop the child table first for the FK.
DROP TABLE IF EXISTS shopee_listing_models;
DROP TABLE IF EXISTS shopee_listings;
