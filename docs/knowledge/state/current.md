---
type: guide
title: Current snapshot
description: What is deployed and working as of 2026-08-09 — head commit, live features, database head, test count, and the day's production events.
tags: [state, snapshot, deployed]
timestamp: 2026-08-09
status: live
sources: [git log, session 2026-08-09, kira-financial-part-progress.md, airplus-insight-built.md]
---

# Current snapshot — 2026-08-09

## Deployed

`main` head is `7fe11e9`. All three apps deploy automatically on merge (since
[PR #125](https://github.com/ladykirsah/Kira.office/pull/125), 2026-08-04 — before that the
storefront had **no** deploy job and merges silently left airplusauto.com stale):

| App | Worker script | Host |
| --- | --- | --- |
| API | `kiraoffice` (no hyphen — see [platform](../platform/index.md)) | api.airplusauto.com |
| Admin | `kiraoffice-admin` | admin.airplusauto.com (behind Cloudflare Access) |
| Storefront | `airplus-storefront` | airplusauto.com |

Database head: migration **0087** (`0087_storefront_events.sql`). Migrations are applied to
prod **before** the merge, by hand — CI never runs them ([operations](../operations/index.md)).

Test suite: ~2,027 vitest tests green as of the last session. `npm run lint` (prettier +
eslint) and `npm run typecheck` both green.

## Recently merged (newest first)

- [#129](https://github.com/ladykirsah/Kira.office/pull/129) — admins are never locked out for 24 h; mechanics still are
- [#128](https://github.com/ladykirsah/Kira.office/pull/128) — unverifiable credentials say "needs resetting", plus owner sign-in via Cloudflare Access identity
- [#126](https://github.com/ladykirsah/Kira.office/pull/126) — day-off submission (ลาแบบ: เต็มวัน / ครึ่งวัน / เข้าสาย), inline edit, delete reserved to the owner
- [#125](https://github.com/ladykirsah/Kira.office/pull/125) — storefront CI deploy job; "merged" now means live for all three apps
- [#124](https://github.com/ladykirsah/Kira.office/pull/124) — AirPlus Insight: Shopee-parity analytics with the profit Shopee can't show
- [#123](https://github.com/ladykirsah/Kira.office/pull/123) — PBKDF2 at 100k rounds (Workers refuses more; every prod login had 500'd)
- [#121](https://github.com/ladykirsah/Kira.office/pull/121) — per-staff logins, HR, wage slips; slip required before an order is paid
- [#120](https://github.com/ladykirsah/Kira.office/pull/120) — admin menu grouped by real function
- [#119](https://github.com/ladykirsah/Kira.office/pull/119) / [#118](https://github.com/ladykirsah/Kira.office/pull/118) — Finance rework and order-detail finance editing

## Production events, 2026-08-09 (this snapshot's day)

- The owner's admin login was repaired **directly in prod D1**: the stored password hash
  matched none of the passwords in play (root cause of a multi-day lockout — see
  [operations incidents](../operations/index.md)). A fresh credential was hashed with the
  project's own `hashPassword`, self-verified with `verifyPassword`, written to the row, and
  proven with a live `POST /staff/login` → 200 `super_admin`. Failure counters cleared, all
  sessions revoked. **No password values are recorded anywhere in this repo.**
- The owner intends to change that password from `/me` and set a PIN there (a PIN cannot be
  set by SQL — `pin_lookup` is HMAC'd with the `STAFF_PIN_PEPPER` secret).
- The owner's account row: `super_admin`, `active`, 100,000 PBKDF2 iterations, no PIN yet.

## Working copies

Development happens in git worktrees under `.claude/worktrees/`. The main checkout at
`~/Developer/Kira.office-main` may lag main — `git pull --ff-only` it before use. Roughly 78
unmerged `origin/claude/*` branches exist; almost all are squash-merge ghosts whose content
is already on main. The exceptions that still matter are listed in [parked.md](parked.md)
and [blockers.md](blockers.md).
