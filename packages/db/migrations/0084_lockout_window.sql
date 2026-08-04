-- "Three failed sign-ins in a row" means a RUN, not a lifetime tally (owner, 2026-08-03).
--
-- Without this column the counter only ever went up: one typo in March plus one in June plus one in
-- August locked the account, which is not what "in a row" means to anybody. Recording when the last
-- failure happened lets a miss older than 15 minutes be forgotten, so the lock fires on what an
-- actual guessing attempt looks like — three tries in a couple of minutes.
--
-- Separate from 0083 because that migration has already been applied to a local database; silently
-- editing an applied migration is how local and production stop matching.
ALTER TABLE users ADD COLUMN last_failed_at integer;
