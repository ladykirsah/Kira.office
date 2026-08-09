---
type: feature
title: Staff password/PIN login — PBKDF2 ceiling, per-role lockout, uniform errors
description: How staff credentials work, the 100k iteration ceiling, and why admins never lock for 24h but mechanics still do
tags: [staff, login, pbkdf2, lockout, pin, password, d1]
timestamp: 2026-08-09
status: live
sources: [kira-owner-lockout-and-access-signin.md, packages/core/src/staffAuth.ts, apps/api/src/staffSession.ts, apps/api/src/lockout.test.ts]
---

# Staff login and lockout

## How it works

Staff sign in to the admin (behind Cloudflare Access — see [access-model](access-model.md)) with email+password or a PIN. Credentials are PBKDF2 hashes stored on the `users` table rows; core logic in `packages/core/src/staffAuth.ts` (`hashPassword` / `verifyPassword`), session + lockout handling in `apps/api/src/staffSession.ts`. The login routes themselves (`/staff/login`, `/staff/login-pin`, `/staff/login-access`) are matched in `apps/api/src/index.ts`; `apps/api/src/staffRoutes.ts` holds the staff-*management* handlers (create staff, set password/role/PIN, day-off, payslips).

- Sessions: `STAFF_SESSION_TTL_MS` = 30 days; rolled after 24 h (`SESSION_ROLL_AFTER_MS`).
- PIN login shares `users.failed_attempts` with password login so the two cannot be brute-forced independently; PIN hashing depends on the `STAFF_PIN_PEPPER` secret — if it is unset the API answers `pin_login_unavailable`, so a PIN that "doesn't match anyone" **proves the pepper IS set** and the lookup found no row (a diagnostic that mattered in the [owner-lockout-incident](owner-lockout-incident.md)).

## The PBKDF2 ceiling (trap)

**Cloudflare Workers refuse PBKDF2 above 100,000 iterations** (`NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`). Staff logins originally shipped hashing at **210,000** rounds — such rows are **permanently unverifiable** on Workers: verification runs at the iteration count stored **on the row**, so pre-fix credentials throw on every attempt, forever.

PR **#123** lowered the constant — `PASSWORD_ITERATIONS = 100_000` and `PBKDF2_MAX_ITERATIONS = 100_000` in `staffAuth.ts` (verified) — but only for **new** credentials. Any row still carrying `password_iterations > 100000` can only be fixed by re-hashing (see `reset-staff-password.mjs` below). A guard in `staffAuth.ts` detects `stored.iterations > PBKDF2_MAX_ITERATIONS` rather than letting the crypto call blow up.

## Lockout rules per role (PR #129, merged 7fe11e9, live 9 Aug 2026)

Base rule: 3 failed attempts **inside the window** → 24-hour lock (`users.failed_attempts`, `locked_until`, `last_failed_at`); an older miss restarts the count.

The owner's change: **admins and super_admins are never locked out** — because the recovery for a lock is "ask a super admin", which is no recovery at all for the super admin. Per `apps/api/src/lockout.test.ts`:

- mechanic: three wrong tries still lock the account (24 h);
- admin / super_admin: wrong guesses are still **counted**, just never **enforced**; the right password always works;
- an admin locked from *before* the change is no longer held out by the old lock.

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
