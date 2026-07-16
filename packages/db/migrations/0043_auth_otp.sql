-- Phone-OTP login codes + request throttling.
-- Codes: 6 digits, 5-minute TTL, max 5 verify attempts, single-use; only a salted SHA-256 hash
-- is stored (PBKDF2 is theater on a 10^6 space — the caps/TTL/single-use are the real controls).
-- Each new send invalidates the phone's prior unconsumed codes (app-level), so at most ONE code
-- is guessable at a time.
CREATE TABLE auth_otp_codes (
  id text PRIMARY KEY NOT NULL,
  phone text NOT NULL,
  code_hash text NOT NULL,
  salt text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  expires_at integer NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at integer,
  created_at integer NOT NULL
);
CREATE INDEX auth_otp_phone_idx ON auth_otp_codes (phone);

-- Fixed-window counters (otp:phone:<p>, otp:ip:<ip>, coupon:ip:<ip> …). Incremented with a
-- SINGLE-STATEMENT upsert (D1 serializes writes, so that is race-free; SELECT-then-UPDATE would
-- not be). Window-edge burst (<=2x) accepted; Cloudflare Turnstile is the primary gate on sends.
CREATE TABLE auth_throttle (
  key text PRIMARY KEY NOT NULL,
  count integer NOT NULL DEFAULT 0,
  window_started_at integer NOT NULL
);
