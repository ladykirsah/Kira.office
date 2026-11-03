-- ตั้งค่าอะไหล่ in the Expo app (owner, 3 Nov 2026).
--
-- A brand can carry its logo: "i want product brand i be able to insert image". The R2 key of the
-- logo, put by PUT /brands/:id/image (same rules as a category's picture). Optional: NULL = no logo.
ALTER TABLE `brands` ADD COLUMN `image_key` text;

-- A category carries the AirPlus description shared by all its products: "can we have 2 places >
-- shown as one paragraph on AirPlus [description on product] / empty 1 line / [description on
-- product setup]". The website shows the product's own description, one empty line, then this.
-- Optional: NULL = the category adds nothing (the product's text shows alone, as before).
ALTER TABLE `product_types` ADD COLUMN `description` text;
