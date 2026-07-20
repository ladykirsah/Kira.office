-- Cover images for the storefront's category and car-brand tiles. Both were placeholder-only:
-- product types rendered a ✦ star ("categories have no photo yet") and car-brand logos were a
-- hardcoded map in storefront code (3 brands). The key points at an R2 object in the `taxonomy/`
-- namespace, served by the api Worker's public GET /img/:key route; NULL means "no cover — render
-- the ✦ placeholder", so every row stays valid without a picture.
ALTER TABLE `product_types` ADD COLUMN `image_key` TEXT;
ALTER TABLE `car_brands` ADD COLUMN `image_key` TEXT;
