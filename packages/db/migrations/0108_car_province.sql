-- Plan 13.11 (owner, 21 Nov 2026): a car is its plate AND its province —
-- "[0][xx] [0000] [province] · the same means everything is the same". Until now
-- "1กก 1234 กรุงเทพมหานคร" and "1กก 1234 เชียงใหม่" were one car: the province lived only on the
-- car's row in `customers`, and every bill, job and history line found its car by the plate alone.
--
-- `plate_province` is the province's official name (packages/core plate.ts canonicalProvince).
-- '' = no province: a parts sale with no car, or a car saved before this whose province nobody
-- typed. From now on the app asks for the province whenever a plate is typed (owner's pick A).
--
-- Live had no cars, bills, history or jobs when this was written (checked 21 Nov 2026), so the
-- copying below matters only for practice copies.

-- 1 · The car list: one row per plate + province (was: one row per plate). No table points at it.
CREATE TABLE customers_new (
  id text PRIMARY KEY NOT NULL,
  license_plate text NOT NULL,
  plate_province text NOT NULL DEFAULT '',
  customer_name text,
  phone text,
  car_model text,
  notes text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  UNIQUE (license_plate, plate_province)
);
INSERT INTO customers_new
  (id, license_plate, plate_province, customer_name, phone, car_model, notes, created_at, updated_at)
  SELECT id, license_plate,
         CASE WHEN TRIM(COALESCE(plate_province, '')) IN ('กทม', 'กทม.', 'กรุงเทพ', 'กรุงเทพฯ')
              THEN 'กรุงเทพมหานคร' ELSE TRIM(COALESCE(plate_province, '')) END,
         customer_name, phone, car_model, notes, created_at, updated_at
  FROM customers;
DROP TABLE customers;
ALTER TABLE customers_new RENAME TO customers;
CREATE INDEX customers_phone_idx ON customers (phone);

-- 2 · Every bill and repair job keeps its car's province, filled from the one province each
-- plate had until now.
ALTER TABLE onsite_sales ADD COLUMN plate_province text NOT NULL DEFAULT '';
UPDATE onsite_sales SET plate_province = COALESCE(
  (SELECT c.plate_province FROM customers c WHERE c.license_plate = onsite_sales.license_plate), '')
  WHERE license_plate IS NOT NULL AND license_plate <> '';

ALTER TABLE repair_jobs ADD COLUMN plate_province text NOT NULL DEFAULT '';
UPDATE repair_jobs SET plate_province = COALESCE(
  (SELECT c.plate_province FROM customers c WHERE c.license_plate = repair_jobs.license_plate), '');
DROP INDEX repair_jobs_plate_idx;
CREATE INDEX repair_jobs_plate_idx ON repair_jobs (license_plate, plate_province);

-- 3 · Old history lines (the paper era): the province joins the re-import key, so the same line
-- for two cars with the same plate is two lines. No table points at it.
CREATE TABLE customer_history_entries_new (
  id TEXT PRIMARY KEY NOT NULL,
  license_plate TEXT NOT NULL,
  plate_province TEXT NOT NULL DEFAULT '',
  happened_at INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  note TEXT,
  lines_json TEXT,
  UNIQUE (license_plate, plate_province, happened_at, description)
);
INSERT INTO customer_history_entries_new
  (id, license_plate, plate_province, happened_at, description, created_at, note, lines_json)
  SELECT h.id, h.license_plate,
         COALESCE((SELECT c.plate_province FROM customers c WHERE c.license_plate = h.license_plate), ''),
         h.happened_at, h.description, h.created_at, h.note, h.lines_json
  FROM customer_history_entries h;
DROP TABLE customer_history_entries;
ALTER TABLE customer_history_entries_new RENAME TO customer_history_entries;
CREATE INDEX customer_history_plate_idx ON customer_history_entries (license_plate, plate_province);

-- 4 · Finding a car's bills by plate + province (the car page and the car list).
CREATE INDEX onsite_sales_car_idx ON onsite_sales (license_plate, plate_province);
