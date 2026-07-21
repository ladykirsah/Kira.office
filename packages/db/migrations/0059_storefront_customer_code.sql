-- The customer's public User ID, shown both in Kira.office and on their own AirPlus account page so
-- the shop and the customer can name the same person out loud (LINE, phone, invoice).
--
-- Nullable + partial UNIQUE index rather than NOT NULL: SQLite cannot ADD COLUMN ... NOT NULL
-- without a constant default, and a constant default would hand every existing row the same code.
-- So: add, backfill each existing row with its own random code, then index.
--
-- `hex(randomblob(4))` yields exactly 8 uppercase hex chars — the same shape `generateCustomerCode()`
-- produces in core, and an alphabet (0-9A-F) with no O/I/L to be misheard as 0/1.
ALTER TABLE storefront_customers ADD COLUMN customer_code text;

UPDATE storefront_customers
   SET customer_code = 'AP-' || hex(randomblob(4))
 WHERE customer_code IS NULL;

CREATE UNIQUE INDEX storefront_customers_code_uq
  ON storefront_customers (customer_code) WHERE customer_code IS NOT NULL;
