-- Real staff logins, replacing Cloudflare Access as the back office's identity source.
--
-- This ADOPTS the `users` table created in 0000_init and never used since: it already holds exactly
-- one row (lady.kirsah@gmail.com, created 2026-07-18) and is already the target of
-- onsite_sales.cashier_user_id and stock_ledger_entries.user_id, so filling it in makes those two
-- foreign keys mean something for the first time. A parallel staff table would have orphaned them.
--
-- Passwords: PBKDF2-HMAC-SHA256, per-account salt, iteration count stored PER ROW so it can be
-- raised later without locking anyone out. Nothing here is reversible — the super admin sees a
-- password once, when they set it. There is no column that can hand one back.

ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN password_salt text;
ALTER TABLE users ADD COLUMN password_iterations integer;
ALTER TABLE users ADD COLUMN password_set_at integer;
ALTER TABLE users ADD COLUMN created_by text REFERENCES users(id);
ALTER TABLE users ADD COLUMN last_login_at integer;

-- Role vocabulary swap. The old AppRole words (owner / manager / stock_operator / finance_viewer)
-- described a system that was never wired up; the three below are the ones the business runs on.
-- Only 'owner' can be present today (verified against prod, 2026-08-03) but the other three are
-- mapped too so this migration is safe against any environment that did use them.
UPDATE users SET role = 'super_admin' WHERE role = 'owner';
UPDATE users SET role = 'admin' WHERE role IN ('manager', 'stock_operator', 'finance_viewer');

-- Anything else is an unknown role: park it as the least-privileged of the three rather than
-- guessing upward. A role SQLite can't CHECK is validated in code on every write and every read.
UPDATE users SET role = 'mechanic' WHERE role NOT IN ('super_admin', 'admin', 'mechanic');

-- Back-office sessions. Same shape as storefront_sessions (0042), which has been carrying the
-- storefront since: the cookie holds a raw 256-bit token, this table holds only its SHA-256, and a
-- row can be revoked — so "log this device out" and "lock someone out right now" both work, which
-- is not true of a stateless JWT.
CREATE TABLE staff_sessions (
  id text PRIMARY KEY NOT NULL,
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id),
  created_at integer NOT NULL,
  expires_at integer NOT NULL,
  last_seen_at integer NOT NULL,
  revoked_at integer
);
CREATE INDEX staff_sessions_user_idx ON staff_sessions (user_id);
CREATE INDEX staff_sessions_expires_idx ON staff_sessions (expires_at);
