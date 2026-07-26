-- Add the 'hold' / 'unhold' movement types for the "on hold" stock bucket (Scan here › On hold).
--
-- Holds are modelled as ledger movements so every existing (unfiltered) SUM(quantity_delta)
-- availability query automatically treats held stock as NOT sellable: a take-away is a 'hold' entry
-- with a NEGATIVE delta, a bring-back is an 'unhold' entry with a POSITIVE delta. That keeps a single
-- source of truth and needs no change to any availability query — the sum already excludes holds.
--
-- SQLite can't ALTER a CHECK, so rebuild the ledger (same shape as migration 0026, verified against
-- the live schema) with the two new values appended. No incoming FKs; the two outgoing FKs and the
-- variant index are preserved.
CREATE TABLE stock_ledger_entries_new (
  id text PRIMARY KEY NOT NULL,
  product_variant_id text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN (
    'opening_balance', 'purchase_receipt', 'manual_adjustment', 'receive', 'write_off',
    'correction', 'onsite_sale', 'online_sale', 'refund_return', 'damaged_lost', 'transfer',
    'reconciliation', 'hold', 'unhold'
  )),
  quantity_delta integer NOT NULL,
  quantity_after integer NOT NULL,
  source_type text,
  source_id text,
  reason text,
  user_id text,
  created_at integer NOT NULL,
  FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
);
INSERT INTO stock_ledger_entries_new
  (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type,
   source_id, reason, user_id, created_at)
  SELECT id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type,
         source_id, reason, user_id, created_at
  FROM stock_ledger_entries;
DROP TABLE stock_ledger_entries;
ALTER TABLE stock_ledger_entries_new RENAME TO stock_ledger_entries;
CREATE INDEX ledger_variant_idx ON stock_ledger_entries (product_variant_id);
