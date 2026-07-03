-- Drop dead inventory scaffolding that nothing reads or writes (verified: 0 runtime references).
--   cost_layers        — FIFO cost layering, never wired (POS passes unitCost from the client).
--   inventory_snapshots — reserved/available/reorder/shopee-published snapshot, never populated.
--   sync_jobs          — retry queue for the future live Shopee API, never used.
-- Also drop the unused location_id from the stock ledger: there is no locations table and the app is
-- single-location, so on-hand is derived per variant only. Drop the old (variant, location) index,
-- drop the column, and re-index on variant alone.
DROP TABLE IF EXISTS cost_layers;
DROP TABLE IF EXISTS inventory_snapshots;
DROP TABLE IF EXISTS sync_jobs;

DROP INDEX IF EXISTS ledger_variant_loc_idx;
ALTER TABLE stock_ledger_entries DROP COLUMN location_id;
CREATE INDEX IF NOT EXISTS ledger_variant_idx ON stock_ledger_entries (product_variant_id);
