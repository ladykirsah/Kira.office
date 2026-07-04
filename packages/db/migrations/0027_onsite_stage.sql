-- On-site document lifecycle (Phase 1). Add a `stage` to onsite_sales:
--   draft / quotation — work-in-progress: NOT revenue, NO stock movement, no bill number yet
--   bill              — a finalized cash bill: posts to the ledger + deducts stock
-- Every existing row is a finalized bill, so DEFAULT 'bill' backfills them cleanly. The revenue,
-- profit, and sales-list queries all filter stage = 'bill' so drafts/quotations never leak into
-- totals, the Sales table, or the CSV export. Additive column with a CHECK — no table rebuild.
ALTER TABLE onsite_sales ADD COLUMN stage text NOT NULL DEFAULT 'bill'
  CHECK (stage IN ('draft', 'quotation', 'bill'));
