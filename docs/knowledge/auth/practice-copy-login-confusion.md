---
type: incident
title: Practice-copy login confusion (24 Aug 2026) — a correct password, the wrong database
description: Why a correct password was rejected, why nothing on screen could have told the owner, and the banner that now says which copy you are looking at
tags: [incident, login, local-dev, worktrees, staff, diagnosis]
timestamp: 2026-08-24
status: historical
sources: [session 2026-08-24, apps/admin/src/lib/practiceCopy.ts, local D1 across four worktrees]
---

# Practice-copy login confusion (24 Aug 2026)

## What happened

The owner could not sign in to the admin and reported the password as certainly correct. It was
correct — for **production**. The screen they were looking at was a **local practice copy** served
from their own machine, which carries its own D1 database and its own `users` rows.

## Root cause

Four working copies existed on the machine, each with a **separate local database**, each reachable
through an identical-looking login page:

| Copy | Owner row |
| --- | --- |
| `kira-office-preview-ux` (the one in use) | hand-seeded 26 Jul, `password_iterations` **1000**, `password_set_at` NULL |
| `sweet-kirch` | a *different* password, set 9 Aug at 18:00 |
| `Kira.office-main` | schema at migration 0025 — no password columns at all |
| `relaxed-meninsky` | schema at 0067; its checkout predates staff logins entirely |

Three different passwords for the same email address, behind three identical screens. The typed
password matched none of the local rows (verified by recomputing PBKDF2 over each stored salt).

## Why diagnosis was fast this time, and why it nearly wasn't

[staff-login-and-lockout](staff-login-and-lockout.md)'s **read the row first** rule worked: one
SELECT showed the row healthy, active, unlocked, `failed_attempts=3` — which alone proves the
handler FOUND the row and ran the failure counter, leaving password mismatch as the only branch
left. Every other rejection reason renders the identical "Email or password is wrong".

The trap that remained: the **iterations were 1000**, not 210000, so this was NOT the
[owner-lockout-incident](owner-lockout-incident.md) ceiling bug, and `credentialNeedsReset` was
correctly false. Reaching for the previous incident's explanation would have wasted the session.

## The prevention gap that allowed it

`DevApiBanner` existed for a near-identical July confusion — and could not help here, twice over:

1. It only warns about local-admin → **REMOTE**-api. This was local → **local**, which
   `describeApiMismatch` deliberately returns `null` for ("the correct dev setup").
2. It renders inside `AppShell`, and **`AppShell` bails out early for `/login`** and for anyone not
   signed in. It is structurally invisible on the one page where a login mystery happens.

Fix: `describePracticeCopy` (`apps/admin/src/lib/practiceCopy.ts`) keyed on the **page hostname
alone**, rendered by `PracticeCopyBanner` from **`layout.tsx`**, not `AppShell`, so it reaches
`/login` and the signed-out state. Not dismissible.

## Standing rules this produced

- **A local admin must say it is local, on every page, before anything goes wrong.** The failure
  mode of a practice copy is not an error — it is a confident wrong belief, so an after-the-fact
  error message cannot catch it.
- **Any banner meant for signed-out users belongs in `layout.tsx`, never `AppShell`.**
- **Practice copies drift.** Each worktree has its own D1 under its own `.wrangler/`; a password set
  in one is invisible to the others. Local credentials were standardised across copies in this
  session so a single practice password works everywhere it can.
- Only one worktree had a fully-populated `.dev.vars`; the others lack `STAFF_PIN_PEPPER` /
  `STAFF_SECRET_KEY`, so **PIN login cannot work there at all** (the API answers
  `pin_login_unavailable`). Password login is unaffected — its salt lives on the row.

## Also found and fixed while diagnosing

- That copy's PIN was stored at **210000 iterations** — the permanently-unverifiable state from
  [owner-lockout-incident](owner-lockout-incident.md), still latent on local rows. Re-set at 100000.
- Its database was one migration behind (0086 vs 0087).
- `Kira.office-main`'s database could not migrate past 0025: a pre-vocabulary `movement_type='refund'`
  ledger row failed migration 0026's CHECK. Normalised to `refund_return` (the intended name) — that
  migration's comment assumes no live row uses the old value, which is untrue of databases seeded
  before the vocabulary settled.

## References

- `apps/admin/src/lib/practiceCopy.ts` + `practiceCopy.test.ts`, `apps/admin/src/app/PracticeCopyBanner.tsx`
- `apps/admin/src/lib/devApiMismatch.ts` (the July sibling), `apps/admin/src/app/AppShell.tsx`
- [staff-login-and-lockout](staff-login-and-lockout.md), [owner-lockout-incident](owner-lockout-incident.md)
