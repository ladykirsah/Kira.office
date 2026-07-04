-- Enforce the canonical channel set at the DB level (arch #2). SQLite can't ADD a CHECK, so each
-- table is rebuilt: create *_new with the CHECK, copy every row (explicit columns), drop old, rename,
-- recreate indexes. Both tables are leaf tables (no incoming FKs), so no FK juggling is needed.
--   sales_orders   — marketplace orders only: shopee | airplus
--   financial_records — all money sources: onsite | shopee | airplus | affiliate (affiliate = commission)

CREATE TABLE sales_orders_new (
  id text PRIMARY KEY NOT NULL,
  channel text NOT NULL CHECK (channel IN ('shopee', 'airplus')),
  external_order_id text NOT NULL,
  order_status text,
  payment_status text,
  subtotal_satang integer DEFAULT 0 NOT NULL,
  discount_total_satang integer DEFAULT 0 NOT NULL,
  tax_total_satang integer DEFAULT 0 NOT NULL,
  fee_total_satang integer DEFAULT 0 NOT NULL,
  grand_total_satang integer DEFAULT 0 NOT NULL,
  order_created_at integer,
  imported_at integer NOT NULL,
  import_source text DEFAULT 'csv' NOT NULL
);
INSERT INTO sales_orders_new
  (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
   discount_total_satang, tax_total_satang, fee_total_satang, grand_total_satang,
   order_created_at, imported_at, import_source)
  SELECT id, channel, external_order_id, order_status, payment_status, subtotal_satang,
         discount_total_satang, tax_total_satang, fee_total_satang, grand_total_satang,
         order_created_at, imported_at, import_source
  FROM sales_orders;
DROP TABLE sales_orders;
ALTER TABLE sales_orders_new RENAME TO sales_orders;
CREATE UNIQUE INDEX order_channel_external_uq ON sales_orders (channel, external_order_id);

CREATE TABLE financial_records_new (
  id text PRIMARY KEY NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  record_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('onsite', 'shopee', 'airplus', 'affiliate')),
  amount_satang integer NOT NULL,
  tax_satang integer DEFAULT 0 NOT NULL,
  fee_satang integer DEFAULT 0 NOT NULL,
  cost_satang integer DEFAULT 0 NOT NULL,
  profit_satang integer DEFAULT 0 NOT NULL,
  occurred_at integer NOT NULL,
  notes text
);
INSERT INTO financial_records_new
  (id, source_type, source_id, record_type, channel, amount_satang, tax_satang,
   fee_satang, cost_satang, profit_satang, occurred_at, notes)
  SELECT id, source_type, source_id, record_type, channel, amount_satang, tax_satang,
         fee_satang, cost_satang, profit_satang, occurred_at, notes
  FROM financial_records;
DROP TABLE financial_records;
ALTER TABLE financial_records_new RENAME TO financial_records;
CREATE INDEX finance_channel_time_idx ON financial_records (channel, occurred_at);
