---
type: guide
title: Bundle change log
description: Chronological history of this knowledge bundle. Append a line whenever a concept changes.
tags: [okf, log, history]
timestamp: 2026-08-09
status: live
sources: [session 2026-08-09]
---

# Change log

- **2026-08-09** — Bundle created. Compiled from 110 session-memory files (via a 6-reader
  extraction pass, 259 facts), the repo's 32 `docs/` files, live repo state at `7fe11e9`
  (migration head 0087), and the day's production events (owner login repaired in prod D1;
  password/PIN rotation pending on `/me`). 81 concept files across 8 areas. Written by the
  outgoing Claude agent as its handover; verified by an adversarial review pass before
  merge.

- **2026-08-24** — Added [auth/practice-copy-login-confusion](auth/practice-copy-login-confusion.md):
  a correct password rejected by a local practice copy, the four-worktree database drift behind it,
  and the `describePracticeCopy` banner now rendered from `layout.tsx` so it reaches `/login`.
  Linked from [auth/index](auth/index.md).

- **2026-08-24** — [auth/roles-model](auth/roles-model.md): recorded that most `staffAuth`
  permission helpers are defined and tested but **never called** (the file's own "enforced in the
  API" claim is false), and added the new super-admin-only product delete
  (`canDeleteProduct`, enforced on `DELETE /products/:id`).
