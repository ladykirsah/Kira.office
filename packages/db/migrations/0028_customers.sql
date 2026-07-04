-- Phase 2: customer directory keyed by car plate (ONE record per car). Auto-created from plated
-- on-site sales; the owner fills/edits name + phone. Phone is the grouping key — a family shares a
-- phone across different plates, so search-by-phone finds all their cars. Sales link by the plate
-- string (which pre-dates this table), so there is no FK; this is a lookup side-table.
CREATE TABLE customers (
  id text PRIMARY KEY NOT NULL,
  license_plate text NOT NULL UNIQUE,
  plate_province text,
  customer_name text,
  phone text,
  car_model text,
  notes text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX customers_phone_idx ON customers (phone);
