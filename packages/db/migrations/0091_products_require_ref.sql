-- A product cannot exist without a Product ID (owner, 2026-08-27).
--
-- product_ref has been nullable since it was added (0006). Migration 0018 made it "the SOLE product
-- identifier" and the barcode's source, and settled for enforcing that "at the app layer" — which
-- the app does, in every route. But a row written any other way (a hand-run SQL fix, a seed, a
-- future importer) could still land without one, and on 2026-08-27 four screens were found reaching
-- straight for `.toLowerCase()` on it, including the till mid-sale. Those are fixed (PR #154); this
-- stops the row being writable at all, so the next screen inherits the guarantee rather than the bug.
--
-- WHY A TRIGGER RATHER THAN `NOT NULL`:
--   1. SQLite cannot add NOT NULL to an existing column — it wants the whole table rebuilt, and
--      `products` carries a foreign key to tax_profiles, a reference to terms_patterns and the
--      products_product_ref_unique index, every one of which would have to be recreated around live
--      data. This moves nothing and is undone with one DROP TRIGGER.
--   2. NOT NULL could not catch the other half anyway. '' and '   ' are values, and a product
--      identified by a blank string is exactly as unusable as one identified by nothing.
--
-- SAFE TO ADD, checked against production before applying (2026-08-27): 12 products, none with a
-- null or blank ref. Every write path already refuses one — createProduct and saveFullProduct throw,
-- and both routes that reach updateProduct guard first. The database now says what the app believed.
--
-- The UPDATE trigger is `OF product_ref` on purpose: an edit that only touches an image or a price
-- must not be re-litigating an identity it is not changing.
--
-- IF A LATER MIGRATION REBUILDS `products`, it must drop these and recreate them afterwards.

DROP TRIGGER IF EXISTS products_require_ref_insert;
CREATE TRIGGER products_require_ref_insert
BEFORE INSERT ON products
WHEN NEW.product_ref IS NULL OR trim(NEW.product_ref) = ''
BEGIN
  SELECT RAISE(ABORT, 'a product needs a Product ID (products.product_ref)');
END;

DROP TRIGGER IF EXISTS products_require_ref_update;
CREATE TRIGGER products_require_ref_update
BEFORE UPDATE OF product_ref ON products
WHEN NEW.product_ref IS NULL OR trim(NEW.product_ref) = ''
BEGIN
  SELECT RAISE(ABORT, 'a product needs a Product ID (products.product_ref)');
END;
