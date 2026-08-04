-- The super admin can read a staff PIN back (owner, 2026-08-03 — reversing the earlier decision
-- that a PIN stays known only to the person who set it).
--
-- Same storage as the password's readable copy: AES-GCM under STAFF_SECRET_KEY, a Worker secret
-- that is NOT in this database. A stolen copy of the data alone still reveals no PINs. The one-way
-- pin_hash from 0083 remains the only thing a login is checked against; this column exists purely
-- so the Staff page can show the six digits when asked.
--
-- Consequence, stated where it will be read: every staff PIN is now something the business holds.
ALTER TABLE users ADD COLUMN pin_cipher text;
