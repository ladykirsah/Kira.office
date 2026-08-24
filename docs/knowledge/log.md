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

- **2026-08-24** — [conventions/admin-consistency-backlog](conventions/admin-consistency-backlog.md):
  item 7 half-closed — `.danger-zone` now uses `--danger-soft` / `--danger-border` tokens in both
  themes; `a.card:hover` is the last token-less colour left.

- **2026-08-24** — Permission matrix ENFORCED (owner's decisions): `canViewFinance`, `canRefund`,
  `canWrite` and `canReviewPaymentRole` now gate real routes via a new `requireRole` helper reading
  the **staff session** (not the Access email, which cannot see mechanics in prod). Finance also
  gains a `NoAccess` page. [auth/roles-model](auth/roles-model.md) rewritten with the enforced/not
  table and the two-identity-systems explanation.

- **2026-08-24** — Bank slips moved onto the staff session (owner: same rule, better identity):
  `privateFileAccess(key, canSeeSlips)` takes a capability instead of an email context, removing a
  fail-open that served customer bank PII whenever `ACCESS_AUD` was unset. `a.card:hover`
  tokenised, closing backlog item 7. Both dark values DERIVED from their light counterparts —
  see [conventions/admin-design-tokens](conventions/admin-design-tokens.md).

- **2026-08-24** — Products table: `Paused` + `Draft` tabs merged into **`Not live`**, which now
  also lists archived rows via the opt-in `GET /products?includeArchived=1` (POS and Barcodes keep
  the unchanged default — an archived part must never be sellable or printable). Status pill gained
  `Archived`. See [back-office/products](back-office/products.md).

- **2026-08-24** — Delete and Archive separated (owner). `DELETE /products/:id` now really removes
  a product, refusing with 409 `has_history` when it has ever been sold or moved stock — sale lines
  keep no product name, so deleting one would damage past orders and the books built from them.
  Archive/restore moved to `POST /products/:id/archive|unarchive` (restore → draft, never active).
  The row menu's Archive item was removed. See [back-office/products](back-office/products.md).
