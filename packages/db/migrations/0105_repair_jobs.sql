-- งานซ่อม — the repair job (plan 10.1, owner 17 Nov 2026). Additive: four new tables, nothing
-- existing changes.
--
-- The owner's flow, in order:
--   in (เข้าใหม่) → check (ตรวจเช็ค) → estimate (ประเมินราคา) → agreed (ลูกค้าตกลงราคา)
--   → waiting_parts (รออะไหล่, only while a part is missing) / working (กำลังซ่อม)
--   → ready (พร้อมรับรถ — the bill is issued to pay) → paid (ชำระเงินแล้ว — the job closes)
-- plus cancelled (ยกเลิก, with a reason). Any step can go back. A job is never deleted.
--
-- Stock (owner's pick A): a part taken for a job moves ขายได้ → งานนอก ('hold' entries with
-- source_type 'repair_job'); when the customer pays it is sold ('unhold' + 'onsite_sale' on the
-- paid bill); a cancel brings it back. Money counts only when paid: the bill row in onsite_sales
-- is written at payment, never before.

CREATE TABLE repair_jobs (
  id text PRIMARY KEY NOT NULL,
  -- JByyyymm-ddnnn, made by the server (Thai date). The job's bill carries the same number, so it
  -- can never clash with a walk-in bill (DAS…) made on a phone.
  job_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'in' CHECK (status IN (
    'in', 'check', 'estimate', 'agreed', 'waiting_parts', 'working', 'ready', 'paid', 'cancelled'
  )),
  -- The car, saved one way (packages/core plate.ts) — the same key the customer list uses.
  license_plate text NOT NULL,
  vehicle text,
  mileage_km integer CHECK (mileage_km IS NULL OR mileage_km >= 0),
  -- อาการ — what the customer reported.
  problem text,
  cancel_reason text,
  -- When the job last reached พร้อมรับรถ — the bill is issued to pay from then.
  bill_issued_at integer,
  -- The paid bill (onsite_sales, stage 'bill', sale_type 'repair').
  sale_id text REFERENCES onsite_sales(id),
  opened_by_user_id text REFERENCES users(id),
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  -- Set when paid or cancelled.
  closed_at integer
);
CREATE INDEX repair_jobs_status_idx ON repair_jobs (status);
CREATE INDEX repair_jobs_plate_idx ON repair_jobs (license_plate);

-- The job's lines: the price estimate first, then the job's bill.
CREATE TABLE repair_job_lines (
  id text PRIMARY KEY NOT NULL,
  job_id text NOT NULL REFERENCES repair_jobs(id),
  line_type text NOT NULL CHECK (line_type IN ('part', 'service')),
  -- A part already in the system. NULL on a service, and on a brand-new part typed by name until
  -- staff add it with เพิ่มสินค้า and link it here.
  product_variant_id text REFERENCES product_variants(id),
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_satang integer NOT NULL CHECK (unit_price_satang >= 0),
  discount_satang integer NOT NULL DEFAULT 0 CHECK (discount_satang >= 0),
  -- estimate: on the price estimate only, no stock
  -- taken:    on the job's bill; a part is in งานนอก for this job
  -- waiting:  a part not in stock yet (รออะไหล่)
  -- sold:     the job is paid
  -- removed:  taken off the job (a taken part went back to ขายได้)
  state text NOT NULL DEFAULT 'estimate' CHECK (state IN (
    'estimate', 'taken', 'waiting', 'sold', 'removed'
  )),
  -- รออะไหล่: when the part should arrive — a date AND a time (owner: "some arrive within a day,
  -- like 14:00").
  expected_at integer,
  position integer NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE INDEX repair_job_lines_job_idx ON repair_job_lines (job_id);

-- One or several mechanics per job.
CREATE TABLE repair_job_mechanics (
  job_id text NOT NULL REFERENCES repair_jobs(id),
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (job_id, user_id)
);

-- Everything that happened to a job, who did it and when. Only ever added to.
CREATE TABLE repair_job_events (
  id text PRIMARY KEY NOT NULL,
  job_id text NOT NULL REFERENCES repair_jobs(id),
  -- opened · status · line_added · line_changed · line_removed · mechanics · paid · cancelled
  kind text NOT NULL,
  from_status text,
  to_status text,
  note text,
  -- The LINE OA update this customer should get for this step (in, check, waiting_parts, working,
  -- ready); NULL when the step sends none. Sending it comes with the "send to car owner" feature.
  customer_update text,
  -- รออะไหล่: the time the customer is told — the last part still waiting.
  expected_at integer,
  user_id text REFERENCES users(id),
  created_at integer NOT NULL
);
CREATE INDEX repair_job_events_job_idx ON repair_job_events (job_id, created_at);
