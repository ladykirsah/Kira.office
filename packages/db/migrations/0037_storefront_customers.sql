-- Storefront (AirPlus) guest-checkout customers, keyed by phone. Deliberately a NEW table, not a
-- change to the plate-keyed `customers` table (that one is NOT NULL UNIQUE on license_plate, built
-- for on-site walk-ins, and the on-site /customers/by-plate flow depends on that constraint). A
-- future pass can link the two tables by phone; out of scope here.
CREATE TABLE storefront_customers (
  id text PRIMARY KEY NOT NULL,
  phone text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
