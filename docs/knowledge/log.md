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

- **2026-08-24** — Pausing left the delete card: the **Live on AirPlus** switch and the row menu are
  now the only places, and the danger zone deletes only. This also unhid a bug — a paused product
  previously had no delete box at all. See [back-office/products](back-office/products.md).

- **2026-08-24** — **Status cell gained a second line: what is stopping this product from
  selling.** After 0088 all eight not-live products read "Paused" and nothing more. The line now
  reads `no photo · no price · no stock`, or **ready to sell** in green when nothing is missing —
  on every tab, and never repeating what the pill already says. Also a **Readiness** sort/filter.
  See [back-office/products](back-office/products.md).

- **2026-08-24** — **Migration 0088 applied to production.** 8 products sat at the retired
  `archived` status; all 8 are now `paused` and appear under **Not live**, where they can be put
  back on sale or deleted properly. Verified after: 0 rows left at `archived`, no migrations
  pending, the public shop still lists exactly the 10 active products, and the demo skincare
  product (`prod-demo`) returns 404. Rollback is the 8 recorded ids back to `archived`.

- **2026-08-24** — **Record section + เงินเบิกล่วงหน้า on the staff profile** (migration 0089).
  Three tabs on the car page's Add new flow — วันหยุด · เบิกล่วงหน้า · จ่ายเงินเดือน — with time and
  money split by a rule, an amber panel for money, and a Save button that always ends with the
  amount. One slip rule for both money forms (`payoutProblem`): **cash needs nothing, a transfer
  needs its slip** — which CHANGED marking a wage paid, where a slip used to be demanded
  unconditionally. Payments now lists the running month and reads
  **เงินเดือน − เบิกไปแล้ว = คงเหลือ**; over-advancing pays ฿0 and shows the excess red as owed.
  See [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-24** — **A person's profile now shows their วันหยุด.** One month at a time (month in
  the URL), with add, edit and delete — the answer to "when was THIS person off" used to need the
  team screen and a scan down a list of everybody. New `GET /staff/:id/days-off`, deliberately not
  the team list filtered in the page: `reason` is free text. Sits above Payments, because a month's
  days off are what produced that month's wage. เงินเบิกล่วงหน้า was designed with the owner the
  same day and **parked** — it is a payroll change, not a screen. See
  [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-24** — **The practice copy now lets you in with one click.** Its separate database
  keeps its own password for the same email, which locked the owner out of their own practice twice
  in one day. `POST /staff/login-practice` needs no credential and is gated on `PRACTICE_COPY=1`
  plus Access being unconfigured — production ships `"0"` explicitly and a test over
  `wrangler.jsonc` fails the build if any environment stops saying so. There is deliberately **no**
  hostname check: `wrangler dev` rewrites the Host header, so locally the Worker believes it is
  `api.homeseeker.me`. See [auth/practice-copy-sign-in](auth/practice-copy-sign-in.md).

- **2026-08-24** — **A dead session bought a silent, nameless back office.** The middleware gates
  on the session cookie merely EXISTING — it has no database — so a revoked, expired or
  deleted-user cookie rendered every page in full, with an empty name badge, no redirect and no
  message. The root layout already knew better and was ignored; it now decides
  (`lib/signedInGate.ts`), and the login page says **"You were signed out."** `?next=` is honoured
  at last, and sanitised against open redirects. See
  [auth/dead-session-silent-access](auth/dead-session-silent-access.md).

- **2026-08-24** — Tier profit unified in `lib/tierProfits.ts`, fixing **three live
  miscalculations**: the edit form charged Shopee a commission based on the AirPlus price, the
  products table charged AirPlus a commission it does not pay, and the edit page's **campaign
  baseline** charged AirPlus that same commission — disagreeing with the AirPlus row on the same
  screen. Four independent prices, one shared cost. See
  [back-office/products](back-office/products.md).

- **2026-08-24** — **Price fields were unusable in production for one release.** `Money` had been
  defined inside `PricingFields`' render body, so every keystroke remounted the input and dropped
  focus; a price could only be typed one character at a time, and a truncated ฿9 saves silently. It
  is back at module level and must stay there. See [back-office/products](back-office/products.md).

- **2026-08-24** — **Admin channel bypass closed.** `POST /products/:id/pause` refused an admin 403
  while the edit page's own save (`POST /products/full`) did the same thing and answered 200.
  `refuseChannelChange()` now guards the save too, and the edit page hides both channel switches
  from anyone but the super admin. See [back-office/products](back-office/products.md).

- **2026-08-25** — **The วันหยุด month picker threw the page to the top.** It navigated with
  `router.push`, so picking a month reloaded the page scrolled to the top — measured at scroll
  975 → 0, putting the card you were reading 1,089px below the fold — while the Payments picker
  beside it never moved. `router.replace(url, { scroll: false })`: the card stays under your
  finger, and Back leaves the page instead of walking back through every month you looked at. The
  month stays in the URL. Still open: the team screen (Staff → วันหยุด) has the same push and is
  still on a bare `<input type="month">`. See
  [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-25** — **Payments became a ledger.** One row per month with a single advance column
  became one month opened out: the salary (always dated the 5th of the following month), every
  advance that came out of it with its own date, note, method and slip, and a Total that is the
  column added up. The Total is what is still to hand over, and the bank account sits under it —
  read-only with a copy button, editing left in the Pay card. `staffPayments` now returns advances
  one by one instead of a monthly sum. Along the way: advance slips could be uploaded since 0089 but
  never viewed, because no route served them — `GET /staff/advances/:id/slip` now does. Still open:
  `deleteAdvance` does not refuse a paid month the way `recordAdvance` does, so deleting an advance
  after payday leaves the frozen payslip figure and the surviving rows disagreeing. See
  [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-25** — **`/me` took the HRM page's shape.** Your details + Pay abreast, then วันหยุด with
  its own month picker, then the same wage ledger, then Signing in. The one intended difference: no
  Record section — the day-off submission form moved to the BOTTOM of the วันหยุด card, so you read
  the month before adding to it. A person's own bank account is now shown in full rather than masked
  (owner's call: hiding it from them protects nobody), while the "Pay into" block under the Total
  stays HRM-only. See [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-25** — **`/me`'s Signing in card stopped being bespoke.** It kept an input box
  permanently open under each secret with a greyed-out Change beside it; it now uses the same
  `SecretRow` the staff-profile page does, with two actions and nothing else — an eye to view, a
  word to change. `SecretRow` gained an optional `generate` (absent = the box opens empty, no ↻, for
  someone setting their own) and an `actionLabel` ("change" rather than "reset"). Validation moved
  into Save so no button ever greys out. See
  [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-25** — **A new password or PIN is typed twice.** On `/me` only: two boxes on one line,
  and Save refuses a disagreeing pair before anything reaches the server. `confirmationProblem`
  compares the entries the way they will be *stored* (trimmed), so a stray trailing space is not a
  mismatch, and an empty second box gets its own message rather than being called a mismatch. The
  owner resetting somebody else's still sees one box — a generated value is on screen to be read.
  See [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-25** — **Deleting an advance from a paid month is refused.** `recordAdvance` had always
  returned 409 for an already-paid month; `deleteAdvance` had not. The payslip freezes
  `advance_satang` at payment, so removing a row afterwards left the frozen figure and the surviving
  rows disagreeing — the failing test measured the rows summing to ฿0 against a payslip still
  reporting ฿2,000. Both calls now make the same check. See
  [back-office/staff-days-off](back-office/staff-days-off.md).

- **2026-08-25** — **The back office speaks Thai and English.** A flag beside the moon, a `kira-lang`
  cookie the server reads, and `{ th, en }` written at the point of use rather than keys in a
  dictionary. Thai is the default. Done: the frame, dashboard, orders list, order detail, products
  and the product forms; the order statuses needed no translating because the owner's Thai was
  already sitting in `operationalStatus.ts` waiting for exactly this. Screen-by-screen review by eye
  kept missing strings, so `lib/untranslated.ts` now finds them by reading source — its first run
  reported 896 across 81 files, 24 of them in screens already called finished — and
  `untranslated.test.ts` fails if a cleared folder regains any. Roughly 790 strings remain, all
  outside the cleared screens. See [conventions/bilingual-admin](conventions/bilingual-admin.md).

- **2026-08-25** — **POS speaks both languages, and its printed receipt stopped lying.** The screen is
  bilingual (ทำบิล · ฉบับร่าง / ทำบิลต่อ · ราคาช่าง · ไปหน้าชำระเงิน). The POS already had its OWN
  language switch, `billLang`, for the bill and quotation — that language belongs to the customer
  holding the bill, not the person at the till, so the app toggle was deliberately kept out of it.
  Four real bugs surfaced while looking: the **thermal receipt** printed `CASH BILL`, `TOTAL`,
  `Subtotal`, `Discount` and `Note:` in English on a Thai bill, while the A4 size used the
  dictionary correctly. And "draft" is now one word app-wide — ฉบับร่าง, the owner's — where products
  had แบบร่าง. See [conventions/bilingual-admin](conventions/bilingual-admin.md).
