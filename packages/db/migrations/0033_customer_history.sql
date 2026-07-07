-- Transcribed legacy service history (the paper/Excel era, imported via the Customers page).
-- MEMORY, NOT MONEY: these rows never touch stock, revenue, or bill numbering — they only show
-- on the car's timeline with their real (old) dates. The UNIQUE key makes re-imports idempotent
-- (INSERT OR IGNORE), mirroring how the customer-directory import is safe to run twice.
CREATE TABLE customer_history_entries (
  id TEXT PRIMARY KEY NOT NULL,
  license_plate TEXT NOT NULL,
  happened_at INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (license_plate, happened_at, description)
);
CREATE INDEX customer_history_plate_idx ON customer_history_entries (license_plate);
