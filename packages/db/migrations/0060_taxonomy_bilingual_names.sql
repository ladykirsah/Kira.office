-- Bilingual names for the managed taxonomy: car brands, car models, car systems (usage_categories)
-- and product categories (product_types).
--
-- Each of these tables has carried exactly ONE `name` since 0005/0007, and the language was never
-- fixed: product_types.name is Thai for the seeded rows but English for everything the owner has
-- added since, while car_brands.name is English. The storefront covered the gap with two hardcoded
-- maps (apps/storefront/src/lib/labels.ts) spanning only 5 part types and 11 car brands, so
-- owner-added rows rendered one line on the tile while mapped rows rendered two.
--
-- `name` IS DELIBERATELY LEFT ALONE. It is identity, not decoration: product_fitments.car_brand
-- references car_brands.name as free TEXT rather than by id, and every table here has a UNIQUE
-- index on it. Rewriting it would silently orphan fitments. name_th / name_en sit beside it and are
-- display-only.
--
-- Both columns are NULLABLE with no default, so this migration is additive and reversible by
-- reverting the application code — the columns simply go unread.

-- `brands` (PART brands: DENSO, Valeo, Cool Gear) is included even though the owner only asked for
-- the four below. listAttributes() selects all five lists through one shared query, so omitting a
-- table here 500s the whole /attributes endpoint — which is exactly what happened the first time
-- this was written. Part brands are mostly proper nouns, but a Thai spelling ("เดนโซ่") is a
-- legitimate thing to want, and uniformity is cheaper than a special case.
ALTER TABLE `brands` ADD COLUMN `name_th` TEXT;
ALTER TABLE `brands` ADD COLUMN `name_en` TEXT;

ALTER TABLE `car_brands` ADD COLUMN `name_th` TEXT;
ALTER TABLE `car_brands` ADD COLUMN `name_en` TEXT;

ALTER TABLE `car_models` ADD COLUMN `name_th` TEXT;
ALTER TABLE `car_models` ADD COLUMN `name_en` TEXT;

ALTER TABLE `usage_categories` ADD COLUMN `name_th` TEXT;
ALTER TABLE `usage_categories` ADD COLUMN `name_en` TEXT;

ALTER TABLE `product_types` ADD COLUMN `name_th` TEXT;
ALTER TABLE `product_types` ADD COLUMN `name_en` TEXT;

-- Backfill by script. Thai is U+0E00–U+0E7F; the catalogue is Thai and English only, so "contains a
-- Thai character" settles which column an existing name belongs in. SQLite has no regex, so this
-- tests for the presence of any Thai character via GLOB against the block's range.
--
-- Mirrors splitLegacyName() in packages/core/src/taxonomyNames.ts — keep the two in step.
UPDATE `brands`          SET `name_th` = `name` WHERE `name` GLOB '*[฀-๿]*';
UPDATE `brands`          SET `name_en` = `name` WHERE `name` NOT GLOB '*[฀-๿]*';
UPDATE `car_brands`      SET `name_th` = `name` WHERE `name` GLOB '*[฀-๿]*';
UPDATE `car_brands`      SET `name_en` = `name` WHERE `name` NOT GLOB '*[฀-๿]*';
UPDATE `car_models`      SET `name_th` = `name` WHERE `name` GLOB '*[฀-๿]*';
UPDATE `car_models`      SET `name_en` = `name` WHERE `name` NOT GLOB '*[฀-๿]*';
UPDATE `usage_categories` SET `name_th` = `name` WHERE `name` GLOB '*[฀-๿]*';
UPDATE `usage_categories` SET `name_en` = `name` WHERE `name` NOT GLOB '*[฀-๿]*';
UPDATE `product_types`   SET `name_th` = `name` WHERE `name` GLOB '*[฀-๿]*';
UPDATE `product_types`   SET `name_en` = `name` WHERE `name` NOT GLOB '*[฀-๿]*';

-- Seed the translations the storefront already knew from its hardcoded maps, so nothing that shows
-- two lines today drops to one after this migration. Only fills the side that is still empty.
UPDATE `car_brands` SET `name_th` = CASE `name`
    WHEN 'Toyota'        THEN 'โตโยต้า'
    WHEN 'Honda'         THEN 'ฮอนด้า'
    WHEN 'Isuzu'         THEN 'อีซูซุ'
    WHEN 'Nissan'        THEN 'นิสสัน'
    WHEN 'Mitsubishi'    THEN 'มิตซูบิชิ'
    WHEN 'Mazda'         THEN 'มาสด้า'
    WHEN 'Ford'          THEN 'ฟอร์ด'
    WHEN 'Chevrolet'     THEN 'เชฟโรเลต'
    WHEN 'Suzuki'        THEN 'ซูซูกิ'
    WHEN 'Mercedes-Benz' THEN 'เมอร์เซเดส-เบนซ์'
    WHEN 'BMW'           THEN 'บีเอ็มดับเบิลยู'
  END
 WHERE `name_th` IS NULL
   AND `name` IN ('Toyota','Honda','Isuzu','Nissan','Mitsubishi','Mazda','Ford','Chevrolet','Suzuki','Mercedes-Benz','BMW');

UPDATE `product_types` SET `name_en` = CASE `name`
    WHEN 'คอยล์เย็น'      THEN 'Evaporator'
    WHEN 'คอมเพรสเซอร์'   THEN 'Compressor'
    WHEN 'คอยล์ร้อน'      THEN 'Condenser'
    WHEN 'มอเตอร์พัดลม'   THEN 'Fan motor'
    WHEN 'ไดเออร์'        THEN 'Receiver drier'
  END
 WHERE `name_en` IS NULL
   AND `name` IN ('คอยล์เย็น','คอมเพรสเซอร์','คอยล์ร้อน','มอเตอร์พัดลม','ไดเออร์');
