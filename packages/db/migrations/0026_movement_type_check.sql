-- Enforce the stock movement_type vocabulary at the DB level (arch #3). Rebuild the ledger with a
-- CHECK. The allowed set is the documented enum PLUS the descriptive manual sub-types the app really
-- writes (receive / write_off / correction from the Stock-movements adjust bar) — so nothing in the
-- live ledger (opening_balance, receive, write_off, ...) is rejected. No incoming FKs; the two
-- outgoing FKs (product_variants, users) are preserved and their referenced rows are intact.
CREATE TABLE stock_ledger_entries_new (
  id text PRIMARY KEY NOT NULL,
  product_variant_id text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN (
    'opening_balance', 'purchase_receipt', 'manual_adjustment', 'receive', 'write_off',
    'correction', 'onsite_sale', 'online_sale', 'refund_return', 'damaged_lost', 'transfer',
    'reconciliation'
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
