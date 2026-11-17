-- VAT billing (plan 10.2, owner 17 Nov 2026). Additive: two new tables, nothing existing changes.
--
-- The owner's model: B2C gets a cash bill; B2B gets a cash bill or a full tax invoice (ใบกำกับภาษี
-- เต็มรูป), picked per sale, with the company's details kept in a book for next time. A tax invoice
-- is made from a paid bill (the counter's or a repair job's), never deleted, cancelled with a reason;
-- refunding a bill that has one makes a credit note (ใบลดหนี้).

-- The company book: buyers that ask for a tax invoice. One row per tax ID and branch.
CREATE TABLE tax_buyers (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  -- 13 digits, kept as digits.
  tax_id text NOT NULL,
  -- 5 digits; 00000 = สำนักงานใหญ่.
  branch text NOT NULL DEFAULT '00000',
  address text NOT NULL,
  phone text,
  created_by_user_id text REFERENCES users(id),
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  UNIQUE (tax_id, branch)
);

-- Tax invoices and credit notes. The seller's and buyer's details and the amounts are kept here as
-- issued, so editing the shop or the company book later never changes a paper already given.
CREATE TABLE tax_documents (
  id text PRIMARY KEY NOT NULL,
  kind text NOT NULL CHECK (kind IN ('tax_invoice', 'credit_note')),
  -- TIyyyymm-nnnn / CNyyyymm-nnnn, made by the server by the Thai month; never reused.
  doc_number text NOT NULL UNIQUE,
  -- The paid bill it is for (onsite_sales, stage 'bill').
  sale_id text NOT NULL REFERENCES onsite_sales(id),
  -- A credit note: the tax invoice it reduces.
  refers_to_id text REFERENCES tax_documents(id),
  -- A tax invoice issued again after a mistake: the cancelled one it replaces.
  replaces_id text REFERENCES tax_documents(id),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  -- A credit note's reason (printed on it).
  reason text,
  cancel_reason text,
  cancelled_at integer,
  cancelled_by_user_id text REFERENCES users(id),
  seller_name text NOT NULL,
  seller_tax_id text NOT NULL,
  seller_branch text NOT NULL,
  seller_address text NOT NULL,
  buyer_id text REFERENCES tax_buyers(id),
  buyer_name text NOT NULL,
  buyer_tax_id text NOT NULL,
  buyer_branch text NOT NULL,
  buyer_address text NOT NULL,
  before_vat_satang integer NOT NULL,
  vat_satang integer NOT NULL,
  total_satang integer NOT NULL,
  issued_by_user_id text REFERENCES users(id),
  -- The server's clock when issued — never a date typed by staff.
  issued_at integer NOT NULL
);
-- One live tax invoice per bill; a cancelled one may be issued again.
CREATE UNIQUE INDEX tax_documents_one_live_invoice ON tax_documents (sale_id)
  WHERE kind = 'tax_invoice' AND status = 'issued';
CREATE INDEX tax_documents_issued_idx ON tax_documents (issued_at);
