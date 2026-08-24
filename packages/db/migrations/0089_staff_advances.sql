-- เงินเบิกล่วงหน้า — salary taken before payday (owner, 2026-08-24).
--
-- Recorded against the MONTH it belongs to, so it can be taken off that month's wage. `period` is
-- stored rather than derived from `given_on` at read time: an advance handed over on the 31st for
-- next month's pay is a real thing, and deriving would file it in the wrong month with no way to
-- correct it.
--
-- `given_on` is a plain Bangkok day like staff_days_off.day — never a timestamp, so a date cannot
-- shift under a timezone.
CREATE TABLE IF NOT EXISTS staff_advances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  period TEXT NOT NULL,                       -- YYYY-MM, the month this comes off
  given_on TEXT NOT NULL,                     -- YYYY-MM-DD
  amount_satang INTEGER NOT NULL,
  method TEXT NOT NULL,                       -- 'cash' | 'transfer'
  slip_key TEXT,                              -- required for transfer; see payoutProblem()
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_advances_user_period ON staff_advances (user_id, period);

-- FROZEN ONTO THE PAYSLIP, like the day rate and the days off already are. A payslip records what
-- was actually paid; recomputing it later is how a September advance would silently rewrite what
-- August handed over. `staff_payslips` exists to be the thing that cannot move.
ALTER TABLE staff_payslips ADD COLUMN advance_satang INTEGER NOT NULL DEFAULT 0;

-- How the wage itself was paid. Nullable because every payslip written before today was made under
-- the old rule, which demanded a transfer slip unconditionally — those rows are transfers, but
-- saying so by backfilling would be inventing a fact, so they read as unknown.
ALTER TABLE staff_payslips ADD COLUMN method TEXT;
