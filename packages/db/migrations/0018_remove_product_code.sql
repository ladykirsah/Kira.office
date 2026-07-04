-- The Product ID (product_ref) is now the SOLE product identifier — it is also the barcode source
-- (see DECISIONS.md / @l-shopee/core resolveProductBarcode). The old internal product_code (P-…) is
-- removed. Forward-only; rollback = re-add the column or restore from the daily R2 backup.
--
-- D1/SQLite note (verified): DROP COLUMN fails while a unique index references the column, so the
-- product_code unique index is dropped first. NOT NULL on product_ref is enforced at the app layer
-- (createProduct/import require a Product ID) since SQLite can't add NOT NULL in place without a
-- table rebuild; the backfill below removes existing NULLs and the unique index blocks duplicates.

-- 1. Every product must have a Product ID — backfill from the old code where one is missing.
UPDATE products SET product_ref = product_code WHERE product_ref IS NULL OR trim(product_ref) = '';

-- 2. Product ID becomes the unique identifier. (Fails loudly if duplicate Product IDs exist — resolve
--    the duplicates before re-applying rather than letting two products share an identity.)
CREATE UNIQUE INDEX products_product_ref_unique ON products(product_ref);

-- 3. Remove the internal product_code (its unique index must go first).
DROP INDEX products_product_code_unique;
ALTER TABLE products DROP COLUMN product_code;
