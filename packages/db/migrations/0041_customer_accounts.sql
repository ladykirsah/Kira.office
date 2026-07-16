-- Storefront customers become ACCOUNTS (AirPlus v2: purchasing requires login).
-- Purely ADDITIVE (a rebuild would trip incoming FKs from addresses/sales_orders — D1 rolls it
-- back). `name` stays NOT NULL; accounts created at OTP-verify (before name capture) insert
-- name = '' as the "not captured yet" sentinel — the app treats '' as missing and fills it at
-- first checkout (prefill later, never silently overwrite).
-- New: phone verification, PDPA consent (Thai law — set on the same statement that creates the
-- row), login bookkeeping, linked-identity slots for phased providers (LINE, Facebook, email).
-- SQLite can't ADD COLUMN ... UNIQUE → plain columns + partial UNIQUE indexes.
ALTER TABLE storefront_customers ADD COLUMN phone_verified_at integer;
ALTER TABLE storefront_customers ADD COLUMN pdpa_consent_at integer;
ALTER TABLE storefront_customers ADD COLUMN last_login_at integer;
ALTER TABLE storefront_customers ADD COLUMN line_user_id text;
ALTER TABLE storefront_customers ADD COLUMN facebook_id text;
ALTER TABLE storefront_customers ADD COLUMN password_hash text;
ALTER TABLE storefront_customers ADD COLUMN status text NOT NULL DEFAULT 'active';
CREATE UNIQUE INDEX storefront_customers_line_uq
  ON storefront_customers (line_user_id) WHERE line_user_id IS NOT NULL;
CREATE UNIQUE INDEX storefront_customers_fb_uq
  ON storefront_customers (facebook_id) WHERE facebook_id IS NOT NULL;
