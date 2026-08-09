---
type: incident
title: Owner lockout (9 Aug 2026) — root cause, the three structural bugs, and the read-the-row-first lesson
description: Why the owner could not sign in, what actually caused it, and how it was diagnosed and fixed
tags: [incident, lockout, staff, pbkdf2, d1, diagnosis]
timestamp: 2026-08-09
status: historical
sources: [kira-owner-lockout-and-access-signin.md, kira-audit-findings-2026-07.md]
---

# Owner lockout incident (9 Aug 2026)

## What happened

The owner could not sign in to admin.airplusauto.com with password **or** PIN. The July audit had already predicted a lockout class ("bootstrap must precede enforcement; the users table has zero writers") — this is that prediction materializing, though via a different final cause.

## Three structural bugs surfaced (all real, all shipped fixes)

1. **No bootstrap** — `createStaff` requires an existing super admin, and `loginStaff` returns "invalid" when no row matches, so the FIRST super admin can only ever be written straight into D1. Fixed durably by [owner-access-sign-in](owner-access-sign-in.md) (#128).
2. **PBKDF2 210k rows are permanently unverifiable** — staff logins shipped at 210,000 rounds but Workers refuse >100,000 (`NotSupportedError`); #123 lowered the constant for NEW credentials only, but verification runs at the count stored ON THE ROW, so pre-#123 credentials throw on every attempt ([staff-login-and-lockout](staff-login-and-lockout.md)).
3. **PIN diagnostics** — a PIN "doesn't match anyone" (not `pin_login_unavailable`) proves `STAFF_PIN_PEPPER` IS set on prod and the lookup simply found no matching row.

## The actual root cause — none of the above

Once prod D1 was readable, the owner's row was **healthy**: `super_admin`, active, `deleted_at`/`locked_until` NULL, `password_iterations` 100000, `failed_attempts=3` — which by itself proves the handler FOUND the row and ran the failure counter. Recomputing PBKDF2 over the stored salt showed **the stored hash matched NONE of the passwords in play** — the reset SQL carrying the intended password had never landed.

Fix: hash with core's own `hashPassword`, **self-check with `verifyPassword` BEFORE writing**, UPDATE the row, then prove with a real `POST /staff/login` → 200 + `super_admin`.

## The costly lesson: READ THE ROW FIRST

Every failure ("no such account", "wrong password", "hash above ceiling", "deactivated", "soft-deleted") renders the same "Email or password is wrong" — indistinguishable from outside the DB. Each plausible cause got diagnosed and fixed **in turn** while the actual state stayed "row fine, password different". One SELECT answers in one call what days of inference cannot:

```sql
SELECT email, role, status, failed_attempts, locked_until,
       password_iterations, length(password_hash) FROM users WHERE lower(email) = ?;
```

## Tooling notes

- **Prod D1 access reversed expectations**: local wrangler OAuth had EXPIRED exactly when needed; the **MCP connector worked**. This reverses the older "MCP 401s, use wrangler" guidance — **try both doors** ([operations](../operations/index.md)).
- Recovery tool: `reset-staff-password.mjs` at repo root — prompts for the password (never an argument; stays out of shell history/chat), hashes with the project's OWN `hashPassword`, upserts on the unique email; `--print-sql` prints the statement for the Cloudflare dashboard D1 console when wrangler login has expired. Beware its `ON CONFLICT(email)` vs case-variant rows ([staff-login-and-lockout](staff-login-and-lockout.md), latent bug).

## Outcome

Fixed same day by #128 (Access-identity sign-in) + the direct row repair; #129 (per-role lockout) and #126 (day-off) merged alongside; CI deployed all three apps, four jobs green.

## References

- PRs #128, #123, #129, #126; commits `aa218ad`, `7fe11e9`, `b417f16`
- [owner-access-sign-in](owner-access-sign-in.md), [staff-login-and-lockout](staff-login-and-lockout.md), [require-access-fail-open](require-access-fail-open.md)
