-- Bug hunt 15 Nov 2026, plan 8.4 (owner picked A, 16 Nov 2026: "fix both fully").

-- Who a parked bill or quotation is for: 'customer' (ลูกค้า prices) or 'mechanic' (ช่าง prices).
-- Before this, a draft was read as ช่าง only when it had a buyer name, so a ช่าง draft saved with
-- the name left blank reopened as a ลูกค้า bill. NULL on older rows: the name rule still decides.
ALTER TABLE onsite_sales ADD COLUMN buyer_kind text;

-- When the customer removed an address that an order (or a claim's replacement) was sent to.
-- The row stays so the order keeps its delivery address; the customer's own list, checkout and
-- "make default" no longer see it (the Shopee way). NULL = in the customer's address book.
ALTER TABLE addresses ADD COLUMN hidden_at integer;
