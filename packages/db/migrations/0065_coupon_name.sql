-- Coupons gain an admin-only "name" (a human label, never shown to customers). Nullable at the DB
-- level so the migration is safe on existing rows; the admin form enforces it on new coupons.
-- Existing coupons are backfilled to their code so nothing shows a blank name.
ALTER TABLE coupons ADD COLUMN name text;
UPDATE coupons SET name = code WHERE name IS NULL;
