-- Bilingual services: optional English name, printed on the English bill.
-- Existing rows default to '' (no English name yet); the bill falls back to the Thai name.
ALTER TABLE services ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
