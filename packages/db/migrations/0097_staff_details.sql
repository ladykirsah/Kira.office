-- The Expo staff page (พนักงาน), owner 2026-11: people with no email, real names, an emergency
-- contact's relation, and who handed the money over.
--
-- ── 1. users.email becomes OPTIONAL ─────────────────────────────────────────────────────────────
-- Many shop staff have no email. They sign in with their 6-digit PIN alone — POST /staff/login-pin
-- already finds the person by PIN through the unique pin_lookup — so an email is no longer what
-- makes an account. The server refuses an account with neither (no email → a PIN is required).
--
-- SQLite cannot drop a NOT NULL, so `users` is rebuilt. Twelve foreign keys point at users(id) —
-- eleven in other tables plus users.created_by — and D1 enforces them, so this is done WITHOUT
-- ever renaming the old table: renaming it would rewrite every one of those foreign keys to follow
-- the old copy.
--
--   a. hold every row in users_hold (a bare copy, no constraints);
--   b. DROP users — with foreign keys deferred, each child row now counts as a pending violation;
--   c. CREATE users again, under the same name, with the new shape;
--   d. put every row back — each row put back settles the violations its children were counting;
--   e. drop the hold and recreate every index users had.
--
-- `PRAGMA defer_foreign_keys` holds the checks until COMMIT (the D1-documented way); D1 applies a
-- migration file as one transaction, so by then every child has its parent again and the count is
-- zero. Outside a transaction (or with a child row whose parent is genuinely missing) the DROP fails
-- loudly instead — it can never leave a half-built users table behind.
--
-- Column list = 0000_init + 0082 + 0083 + 0084 + 0085 + 0090, in the order the live table has them
-- (checked against PRAGMA table_info(users) on the local database), plus the three new ones.
PRAGMA defer_foreign_keys = on;

CREATE TABLE users_hold AS SELECT * FROM users;

DROP TABLE users;

CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  -- The one-line display name. For people added from the Expo app it is the Thai nickname.
  name text NOT NULL,
  -- NULLABLE from here on: a PIN-only person has none. Still UNIQUE when present (index below;
  -- SQLite lets any number of rows hold NULL in a unique index).
  email text,
  role text NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  created_at integer NOT NULL,
  password_hash text,
  password_salt text,
  password_iterations integer,
  password_set_at integer,
  created_by text REFERENCES users(id),
  last_login_at integer,
  -- ชื่อเล่น — the NICKNAMES, Thai and English. What the shop calls them.
  name_th text,
  name_en text,
  phone text,
  emergency_phone text,
  emergency_name text,
  photo_key text,
  started_on integer,
  pin_hash text,
  pin_salt text,
  pin_iterations integer,
  pin_lookup text,
  pin_set_at integer,
  password_cipher text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until integer,
  day_rate_satang integer,
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  deleted_at integer,
  last_failed_at integer,
  pin_cipher text,
  recovery_hash text,
  recovery_salt text,
  recovery_iterations integer,
  recovery_lookup text,
  recovery_set_at integer,
  -- ── 2. New ──────────────────────────────────────────────────────────────────────────────────
  -- ชื่อจริง — the person's real (legal) full name, Thai and English. Separate from the nickname.
  full_name_th text,
  full_name_en text,
  -- เกี่ยวข้องเป็น — how the emergency contact is related to them, e.g. แม่. Free text.
  emergency_relation text
);

INSERT INTO users (
  id, name, email, role, status, created_at,
  password_hash, password_salt, password_iterations, password_set_at, created_by, last_login_at,
  name_th, name_en, phone, emergency_phone, emergency_name, photo_key, started_on,
  pin_hash, pin_salt, pin_iterations, pin_lookup, pin_set_at, password_cipher,
  failed_attempts, locked_until, day_rate_satang, bank_name, bank_account_no, bank_account_name,
  deleted_at, last_failed_at, pin_cipher,
  recovery_hash, recovery_salt, recovery_iterations, recovery_lookup, recovery_set_at
)
SELECT
  id, name, email, role, status, created_at,
  password_hash, password_salt, password_iterations, password_set_at, created_by, last_login_at,
  name_th, name_en, phone, emergency_phone, emergency_name, photo_key, started_on,
  pin_hash, pin_salt, pin_iterations, pin_lookup, pin_set_at, password_cipher,
  failed_attempts, locked_until, day_rate_satang, bank_name, bank_account_no, bank_account_name,
  deleted_at, last_failed_at, pin_cipher,
  recovery_hash, recovery_salt, recovery_iterations, recovery_lookup, recovery_set_at
FROM users_hold;

DROP TABLE users_hold;

-- Every index users had: 0000_init, 0083, 0090. The DROP above took them with it.
CREATE UNIQUE INDEX users_email_unique ON users (email);
CREATE UNIQUE INDEX users_pin_lookup_unique ON users (pin_lookup) WHERE pin_lookup IS NOT NULL;
CREATE UNIQUE INDEX users_recovery_lookup_unique
  ON users (recovery_lookup) WHERE recovery_lookup IS NOT NULL;

-- ── 3. คนจ่าย — who handed the money over ─────────────────────────────────────────────────────
-- An active super admin, chosen on the pay form (default: whoever is signed in). Separate from
-- created_by on an advance, which is who TYPED it in. Rows written before today stay NULL: who paid
-- them was never recorded, and filling it in now would be inventing a fact.
ALTER TABLE staff_payslips ADD COLUMN paid_by text REFERENCES users(id);
ALTER TABLE staff_advances ADD COLUMN paid_by text REFERENCES users(id);
