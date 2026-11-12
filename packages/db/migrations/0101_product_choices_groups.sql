-- ตัวเลือกสินค้า (sizes) and กลุ่มสินค้า (groups) on หน้าสินค้า — drawn and approved 7 Nov 2026.
--
-- A choice is a product_variants row, as the table was always meant to hold: its own code
-- (barcode_primary), prices (pricing_profiles) and stock (stock_ledger_entries). option_1_name holds
-- the option's name ("ขนาด"), the same on every choice of one product; option_1_value holds the
-- choice ("3/8 เล็ก"). A product whose variants have no option_1_value has no choices.

-- The choice's one photo (an R2 key under products/), "sub-product can have 1 pic" (owner, 7 Nov).
-- NULL = none yet; the product's own first photo stands in until one is added.
ALTER TABLE product_variants ADD COLUMN image_key text;

-- กลุ่มสินค้า: products that stand in for each other (another brand of the same part for the same
-- car). Every product keeps its own page; products sharing a group_id list each other. NULL = in no
-- group. A group never has fewer than two products — the last one left is taken out too.
ALTER TABLE products ADD COLUMN group_id text;
CREATE INDEX products_group_idx ON products (group_id);
