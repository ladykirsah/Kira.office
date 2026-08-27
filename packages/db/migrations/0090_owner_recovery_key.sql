-- The owner's emergency key (owner's decision, 2026-08-26).
--
-- A SECOND way back into the shop, standing beside the emailed Cloudflare Access code rather than
-- replacing it. The two fail differently on purpose: the emailed code proves you hold the mailbox,
-- and is useless when Cloudflare or that mailbox is itself the thing that is broken — which is the
-- situation this door exists for. The owner asked for both, side by side.
--
-- SHAPED EXACTLY LIKE THE PIN (0083), and for the same reason: the key is typed ALONE, with no
-- email beside it, so it has to identify the person as well as authorise them.
--   1. recovery_lookup is a UNIQUE peppered HMAC — the fast, exact lookup that finds the candidate
--      row. UNIQUE so two people can never hold the same key.
--   2. recovery_hash is the slow PBKDF2 that actually decides. A single fast digest alone would
--      make a short key as weak as its own hash.
--
-- NO READABLE COPY, deliberately — and this is the one place it departs from the PIN. `pin_cipher`
-- exists (0085) because the owner resets other people's PINs and must be able to read them back.
-- Nobody ever needs to read THIS one: it is the owner's own, set by them, and a key that cannot be
-- revealed cannot be revealed by anyone else either. Lose it and you set a new one.
--
-- WHY NOT REUSE users.pin_* — a person can hold both. The PIN is the everyday door; this is the one
-- for when that door will not open, and a locked account must not take its own rescue down with it.
ALTER TABLE users ADD COLUMN recovery_hash text;
ALTER TABLE users ADD COLUMN recovery_salt text;
ALTER TABLE users ADD COLUMN recovery_iterations integer;
ALTER TABLE users ADD COLUMN recovery_lookup text;
ALTER TABLE users ADD COLUMN recovery_set_at integer;
CREATE UNIQUE INDEX users_recovery_lookup_unique
  ON users (recovery_lookup) WHERE recovery_lookup IS NOT NULL;
