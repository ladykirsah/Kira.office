-- Wage transfer slips (owner, 2026-08-04).
--
-- A payment cannot be confirmed without one, so every paid month has proof of the transfer. The
-- IMAGE lives in R2 under salary-slip/ and is deleted three months after the payment; the payslip
-- row it hangs off is a financial record and is never deleted.
--
-- slip_key is therefore NULLABLE by design: NULL means "the image is gone", which after three
-- months is the normal, expected state of an old payslip.
ALTER TABLE staff_payslips ADD COLUMN slip_key text;

-- Uploaded when, so the sweep has something to sort by and a human can see how fresh the proof is.
ALTER TABLE staff_payslips ADD COLUMN slip_uploaded_at integer;

-- The nightly purge asks one question: which slips are still here and old enough to go? Without
-- this it is a full scan of every payslip ever written, once a day, forever.
CREATE INDEX staff_payslips_slip_sweep ON staff_payslips (paid_at) WHERE slip_key IS NOT NULL;
