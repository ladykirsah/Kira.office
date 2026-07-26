-- Preserve the bill-level discount on a parked draft/quotation so a reopened quote restores the
-- exact %/฿ the staff entered (not just the computed baht). discount_total_satang already stores the
-- computed amount; these keep the raw input for a faithful reopen. Both nullable — bills don't use
-- them (their reprint path reconstructs a ฿ discount from the amount).
ALTER TABLE onsite_sales ADD COLUMN discount_kind TEXT;
ALTER TABLE onsite_sales ADD COLUMN discount_value TEXT;
