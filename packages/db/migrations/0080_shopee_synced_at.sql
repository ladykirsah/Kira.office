-- The dashboard "Update on Shopee" worklist reminds the owner to hand-update Shopee stock after a
-- Kira-side change (Shopee stock is not auto-linked — see the stock roadmap). shopee_synced_at is the
-- epoch-ms the owner last reconciled THIS product onto Shopee, stamped by the worklist's "Clear done"
-- action. A product appears on the list only while it has a stock movement newer than this, so a
-- cleared row stays cleared until the stock changes again. NULL = never reconciled (any movement
-- counts). Only meaningful for products with shopee_listed = 1.
ALTER TABLE products ADD COLUMN shopee_synced_at integer;
