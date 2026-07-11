-- DB-backed storefront sessions (revocable — logout-everywhere works, unlike stateless JWTs).
-- The cookie carries the RAW 256-bit token; only its SHA-256 hash is stored here.
CREATE TABLE storefront_sessions (
  id text PRIMARY KEY NOT NULL,
  token_hash text NOT NULL UNIQUE,
  customer_id text NOT NULL REFERENCES storefront_customers(id),
  created_at integer NOT NULL,
  expires_at integer NOT NULL,
  last_seen_at integer NOT NULL,
  revoked_at integer
);
CREATE INDEX storefront_sessions_customer_idx ON storefront_sessions (customer_id);
CREATE INDEX storefront_sessions_expires_idx ON storefront_sessions (expires_at);
