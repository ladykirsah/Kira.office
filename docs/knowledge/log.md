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

- **2026-08-24** — Products table: the **AirPlus** column became **Status**, mirroring the tabs
  (Live / Low / Out / Paused / Draft / Archived) with not-live states outranking stock. Reverses the
  2 Aug decision that folded "Out" into Active. See [back-office/products](back-office/products.md).

- **2026-08-24** — Product model SETTLED after a second round: **"archived" retired into "paused"**
  (migration **0088**), leaving three states — active / draft / paused — and two removal actions:
  pause (reversible, resume puts it back on sale) and delete (permanent, refused with history).
  Routes renamed `archive|unarchive` → `pause|resume`; the `includeArchived` opt-in is gone.
  [back-office/products](back-office/products.md) rewritten to the settled model.

- **2026-08-24** — Row menu became **Edit · Pause on AirPlus · Mark paused on Shopee**: the two
  channels pause independently. AirPlus is real (`status`); Shopee is bookkeeping only
  (`shopee_listed` → the manual worklist), and the label says so. See
  [back-office/products](back-office/products.md).

- **2026-08-24** — Product table by role: a mechanic gets the **All** tab only, no edit anywhere, and
  **no profit** (the API withholds `itemCostSatang` rather than blanking a number); an admin
  **cannot change a price** (`canEditPrice`, super-admin only) but may still price a NEW product.
  Fixed a server-side trap on the way: `apiFetch` did not forward the staff session from server
  components, so role-shaped GETs degraded to their most restricted form. See
  [auth/roles-model](auth/roles-model.md).

- **2026-08-24** — Pricing split refined (owner): an admin may change the item COST and VAT-on-cost;
  the SELLING tiers and commission are the owner's. Enforced by comparing a save against stored
  values on **both** `PUT /products/:id/pricing` and `POST /products/full` — the edit page uses the
  latter, so guarding only the former had left the real door open.

- **2026-08-24** — One switch per sales channel. The edit page gained a **Live on AirPlus** toggle
  beside **Live on Shopee**, and the row menu now offers **Live on AirPlus** on a draft. Together
  these removed the old side effect where "Active on Shopee" also published to AirPlus — it did so
  only because it was the single way to publish from that page. See
  [back-office/products](back-office/products.md).

- **2026-08-24** — Product page: **Shopee ID** removed (permanently "—" with no Shopee API), and the
  "Shopee" field became **Status**, carrying a tag per channel — `Active on AirPlus` /
  `Active on Shopee`. See [back-office/products](back-office/products.md).
