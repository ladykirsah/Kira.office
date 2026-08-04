-- Staff profiles, quick-PIN login, day-off records and payroll (owner decisions, 2026-08-03).
--
-- Separate from 0082 (which is only logins) because these are different concerns: 0082 is the gate,
-- this is the personnel record behind it. Neither has reached production yet.

-- ── Profile ─────────────────────────────────────────────────────────────────────────────────────
-- Thai and English names are BOTH kept, in their own columns, following the taxonomy convention
-- from 0060 (name_th / name_en). `name` stays as the display fallback so nothing that already
-- selects it breaks.
ALTER TABLE users ADD COLUMN name_th text;
ALTER TABLE users ADD COLUMN name_en text;
ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE users ADD COLUMN emergency_phone text;
ALTER TABLE users ADD COLUMN emergency_name text;
ALTER TABLE users ADD COLUMN photo_key text;
ALTER TABLE users ADD COLUMN started_on integer;

-- ── Quick login by PIN ──────────────────────────────────────────────────────────────────────────
-- A PIN is entered ALONE — no email — so it has to identify the person as well as authenticate
-- them. Two consequences, both enforced in code:
--   1. pin_lookup is a UNIQUE hash of the PIN, so no two staff can hold the same six digits.
--   2. pin_hash is the slow PBKDF2 check that actually authorises. The fast unique lookup finds the
--      candidate row; the slow hash decides. (A single fast hash alone would make the PIN as weak
--      as an unsalted digest of six digits.)
ALTER TABLE users ADD COLUMN pin_hash text;
ALTER TABLE users ADD COLUMN pin_salt text;
ALTER TABLE users ADD COLUMN pin_iterations integer;
ALTER TABLE users ADD COLUMN pin_lookup text;
ALTER TABLE users ADD COLUMN pin_set_at integer;
CREATE UNIQUE INDEX users_pin_lookup_unique ON users (pin_lookup) WHERE pin_lookup IS NOT NULL;

-- ── Password the owner can read back ────────────────────────────────────────────────────────────
-- The owner's explicit decision (asked twice): they must be able to reveal any staff password at any
-- time. This column holds the password encrypted with AES-GCM under a key kept in a Worker secret,
-- NOT in this database — so a stolen copy of the data alone reveals nothing. The one-way
-- password_hash from 0082 is still what logins are checked against; if the key is ever lost, every
-- login keeps working and only the reveal stops.
ALTER TABLE users ADD COLUMN password_cipher text;

-- ── Lockout ─────────────────────────────────────────────────────────────────────────────────────
-- 3 failures (PIN or password, counted together) locks the account for 24 hours, liftable by nobody
-- — the owner's rule. Kept on the row rather than in auth_throttle because it is account state the
-- Staff page has to show, not a transient counter.
ALTER TABLE users ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until integer;

-- ── Pay ─────────────────────────────────────────────────────────────────────────────────────────
-- Day rate in satang, like every other amount in this database. Salary is day_rate x working days,
-- where working days = days in the month minus recorded days off. Nothing is added or deducted.
ALTER TABLE users ADD COLUMN day_rate_satang integer;
ALTER TABLE users ADD COLUMN bank_name text;
ALTER TABLE users ADD COLUMN bank_account_no text;
ALTER TABLE users ADD COLUMN bank_account_name text;

-- ── Leaving ─────────────────────────────────────────────────────────────────────────────────────
-- "Delete" keeps the person's name on the bills and stock movements they made (owner's choice), so
-- the row survives as a tombstone: identity and contact details are wiped, the display name stays,
-- and every staff list filters deleted_at — the same soft-delete rule the rest of this schema uses.
ALTER TABLE users ADD COLUMN deleted_at integer;

-- ── Days off ────────────────────────────────────────────────────────────────────────────────────
-- Self-reported, no approval step (owner: "so they can inform by themselves"). Half days are stored
-- as halves = 1 so payroll can stay in whole-number arithmetic; a full day is halves = 2.
CREATE TABLE staff_days_off (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  day text NOT NULL,                -- 'YYYY-MM-DD', local Thai date
  halves integer NOT NULL,          -- 1 = half day, 2 = full day
  reason text,
  created_at integer NOT NULL,
  created_by text REFERENCES users(id)
);
CREATE UNIQUE INDEX staff_days_off_unique ON staff_days_off (user_id, day);
CREATE INDEX staff_days_off_month_idx ON staff_days_off (user_id, day);

-- ── Payroll ─────────────────────────────────────────────────────────────────────────────────────
-- One row per person per month. The figures are SNAPSHOT at run time — day rate and days off are
-- copied in, not looked up later. A raise in September must not silently rewrite what August paid.
CREATE TABLE staff_payslips (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  period text NOT NULL,             -- 'YYYY-MM'
  day_rate_satang integer NOT NULL,
  days_in_month integer NOT NULL,
  off_halves integer NOT NULL,
  working_halves integer NOT NULL,
  amount_satang integer NOT NULL,
  paid_at integer,
  created_at integer NOT NULL
);
CREATE UNIQUE INDEX staff_payslips_unique ON staff_payslips (user_id, period);
CREATE INDEX staff_payslips_period_idx ON staff_payslips (period);

-- ── Activity ────────────────────────────────────────────────────────────────────────────────────
-- "All changes update to me": staff can change their own password and PIN, so every such change is
-- recorded here for the owner to read. Distinct from audit_logs, which records API mutations by
-- path — this is a human-readable people log.
CREATE TABLE staff_activity (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  kind text NOT NULL,               -- password_changed | pin_changed | day_off | locked | profile_edited
  detail text,
  created_at integer NOT NULL
);
CREATE INDEX staff_activity_recent_idx ON staff_activity (created_at);
