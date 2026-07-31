-- Payment-slip evidence (owner, 31 Jul 2026).
--
-- The storefront used to decode a slip's QR on the phone and keep no image. The owner wants the
-- actual uploaded slip retained as evidence, viewable in the back office. This is the R2 key of that
-- image (namespace `slip/`), served only through the private, super-admin-gated /file route — a bank
-- slip is financial PII and must never sit on the public /img route. Null for COD and for any order
-- whose slip predates this column.
ALTER TABLE sales_orders ADD COLUMN slip_image_key TEXT;
