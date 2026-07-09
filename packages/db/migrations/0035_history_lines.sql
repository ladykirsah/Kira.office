-- Structured legacy visits: a transcribed visit renders like a real Kira bill (line items with
-- product name · brand + product ID, plus a bill note) instead of one folded text blob.
-- Still MEMORY, NOT MONEY — no prices, no stock, no revenue. Additive + nullable, so existing
-- text-only entries keep working (the app falls back to splitting `description` by newline).
-- note      = the visit's bill note (ประวัติ · หมายเหตุ), shown once at the bottom.
-- lines_json= JSON array of {description, productRef} per line item, for bill-style rendering.
ALTER TABLE customer_history_entries ADD COLUMN note TEXT;
ALTER TABLE customer_history_entries ADD COLUMN lines_json TEXT;
