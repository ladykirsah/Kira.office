---
type: feature
title: Staff password/PIN login — PBKDF2 ceiling, lockout for everyone, per-caller throttle, uniform errors
description: How staff credentials work, the 100k iteration ceiling, why EVERY role now locks after 3 tries (reversing 9 Aug), and the per-caller throttle the account lock cannot replace
tags: [staff, login, pbkdf2, lockout, throttle, brute-force, pin, password, d1]
timestamp: 2026-08-25
status: live
sources: [kira-owner-lockout-and-access-signin.md, packages/core/src/staffAuth.ts, apps/api/src/staffSession.ts, apps/api/src/lockout.test.ts, apps/api/src/loginThrottle.ts, session 2026-08-25]
---

# Staff login and lockout

## How it works

Staff sign in to the admin with email+password or a PIN — and since 25 Aug 2026 that IS the lock, not a name badge behind Cloudflare Access ([access-model](access-model.md)). Credentials are PBKDF2 hashes stored on the `users` table rows; core logic in `packages/core/src/staffAuth.ts` (`hashPassword` / `verifyPassword`), session + lockout handling in `apps/api/src/staffSession.ts`. The login routes themselves (`/staff/login`, `/staff/login-pin`, `/staff/login-access`) are matched in `apps/api/src/index.ts`; `apps/api/src/staffRoutes.ts` holds the staff-*management* handlers (create staff, set password/role/PIN, day-off, payslips).

- Sessions: `STAFF_SESSION_TTL_MS` = 30 days; rolled after 24 h (`SESSION_ROLL_AFTER_MS`).
- PIN login shares `users.failed_attempts` with password login so the two cannot be brute-forced independently; PIN hashing depends on the `STAFF_PIN_PEPPER` secret — if it is unset the API answers `pin_login_unavailable`, so a PIN that "doesn't match anyone" **proves the pepper IS set** and the lookup found no row (a diagnostic that mattered in the [owner-lockout-incident](owner-lockout-incident.md)).

## The PBKDF2 ceiling (trap)

**Cloudflare Workers refuse PBKDF2 above 100,000 iterations** (`NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`). Staff logins originally shipped hashing at **210,000** rounds — such rows are **permanently unverifiable** on Workers: verification runs at the iteration count stored **on the row**, so pre-fix credentials throw on every attempt, forever.

PR **#123** lowered the constant — `PASSWORD_ITERATIONS = 100_000` and `PBKDF2_MAX_ITERATIONS = 100_000` in `staffAuth.ts` (verified) — but only for **new** credentials. Any row still carrying `password_iterations > 100000` can only be fixed by re-hashing (see `reset-staff-password.mjs` below). A guard in `staffAuth.ts` detects `stored.iterations > PBKDF2_MAX_ITERATIONS` rather than letting the crypto call blow up.

## Lockout rules per role — EVERYONE locks (owner, 25 Aug 2026)

Base rule: 3 failed attempts **inside the window** → 24-hour lock (`users.failed_attempts`, `locked_until`, `last_failed_at`); an older miss restarts the count. `roleCanBeLocked()` in `packages/core/src/staffPay.ts` now returns **true for every role**.

**History, because the reversal is the interesting part.** PR #129 (9 Aug 2026) exempted admins and super_admins, on two supports that have both since gone:

1. *"The only recovery for a lock is 'ask a super admin'"* — nobody, when the locked-out person IS the super admin. There is now **`/recover`** ([owner-access-sign-in](owner-access-sign-in.md)), which proves the owner by an emailed code and signs them back in unaided.
2. *"Cloudflare Access already stands in front of the admin"* — so the lock was a second fence behind a locked gate. The owner has made the Kira.office form the everyday door ([access-model](access-model.md)), which puts it on the open internet and makes this lock the whole defence.

Current behaviour, per `apps/api/src/lockout.test.ts`:

- every role: three wrong tries → 24-hour lock, and the RIGHT password is refused while it stands;
- below the limit, misses are counted and a clean sign-in wipes the tally;
- a standing lock from before this change now holds (nobody was mid-lock when it shipped — the only prod row had `failed_attempts = 0`);
- an expired lock lets the right password through again.

## The per-caller throttle — what the account lock CANNOT do

The account lock is keyed to an **account**, and PIN sign-in has no account until the PIN matches one. `loginWithPin` looks the row up by the PIN's peppered hash and, finding none, answers "invalid" having touched nothing — right in itself, since punishing a guess would leak which six digits are in use. The consequence: **every wrong PIN is free, and there are only 999,999 of them.**

`apps/api/src/loginThrottle.ts` counts failures against the CALLER instead — 20 per 15-minute window, then 429 with `Retry-After`. Notes that matter:

- Storage is **`auth_throttle`**, the same table and the same single-statement fixed-window upsert the storefront's OTP limits use (`takeThrottle` in `apps/storefront/src/lib/auth.ts`). Keys are namespaced `staff-login:ip:` so neither flow can spend the other's budget. The two implementations are still separate code in separate apps.
- **Only failures count.** Counting every attempt would charge a busy counter machine for its normal day, since a shop shares one address.
- **`cf-connecting-ip` first, always** — the edge stamps it and a caller cannot forge it, so somebody hitting the API directly can never choose their bucket. `x-kira-client-ip`, forwarded by the admin's `/api/staff/login` route, is consulted **only** when the edge header is absent, which happens for that server-to-server proxy and never for a request off the internet. Without that fallback the API would be counting the admin *Worker* and every member of staff would share one bucket.
- Verified live: attempts 1–20 answer 401, the 21st answers 429 with `Retry-After`, and a different address is unaffected.

## Uniform error surface (lesson, and a deliberate property)

Every failure — no such account, wrong password, hash above the ceiling, deactivated, soft-deleted — renders the same **"Email or password is wrong"**. Good against enumeration; terrible for diagnosis: it is indistinguishable from outside the DB. **When a login mystery appears, read the row FIRST:**

```sql
SELECT email, role, status, failed_attempts, locked_until,
       password_iterations, length(password_hash) FROM users WHERE lower(email) = ?;
```

One call answers what days of inference cannot ([owner-lockout-incident](owner-lockout-incident.md)).

## Bootstrap gap (structural)

`createStaff` requires an existing super admin, and `loginStaff` returns "invalid" when no row matches — so the **first** super admin can only ever be written straight into D1. There is no seed script. Enabling enforcement against an empty `users` table locks everyone out (July audit warning that later materialized). The durable mitigation is the Access-identity sign-in: [owner-access-sign-in](owner-access-sign-in.md).

## Latent bug: case-sensitive unique index vs lower() lookups (status: open)

`users_email_unique` is on **raw** email (case-sensitive) while every lookup is `WHERE lower(email) = ?` + `.first()`. Two rows differing only in case can coexist, and login would pick one arbitrarily. `createStaff` lowercases before inserting, so only **hand-written SQL** can create the collision — and `reset-staff-password.mjs`'s `ON CONFLICT(email)` would MISS a differently-cased existing row and insert a duplicate instead of updating. **When writing any manual staff-row SQL: lowercase the email first and check for case-variant rows.**

## Recovery tool

`reset-staff-password.mjs` (repo root): prompts for the password (never an argument — stays out of shell history and chat), hashes with the project's **own** `hashPassword`, self-checks with `verifyPassword`, upserts on the unique email. `--print-sql` prints the statement for pasting into the Cloudflare dashboard D1 console when `wrangler login` has expired. Prod D1 access paths are in [operations](../operations/index.md).

## References

- `packages/core/src/staffAuth.ts`, `packages/core/src/staffAuth.test.ts`
- `apps/api/src/index.ts` (login route matching), `apps/api/src/staffSession.ts`, `apps/api/src/staffRoutes.ts`, `apps/api/src/lockout.test.ts`
- `reset-staff-password.mjs`; PRs #123, #129
