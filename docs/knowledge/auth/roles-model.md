---
type: convention
title: Roles model — viewerRole email lists, not the dormant rbac.ts
description: super_admin / mechanic / admin via env email lists; per-capability gates; slip images super-admin only
tags: [roles, rbac, super-admin, mechanic, permissions, slip]
timestamp: 2026-08-24
status: live
sources: [kira-defect-claim-flow.md, kira-slip-super-admin-gating.md, kira-staff-mechanic-section-plan.md, packages/core/src/access.ts]
---

# Roles model

## What it is

The live roles system is **lightweight email-list matching**, implemented as `viewerRole(email, { superAdminEmails, mechanicEmails, accessConfigured })` in `packages/core/src/access.ts` (the source memory said "apps/api access.ts"; verified location is packages/core). Three roles:

| Role | Who |
|---|---|
| `super_admin` | email in `SUPER_ADMIN_EMAILS` |
| `mechanic` | email in `MECHANIC_EMAILS` (env) |
| `admin` | every other Cloudflare Access user |

Local dev (Access off) → `super_admin`, the same deliberate fail-open as `isSuperAdmin` (see [require-access-fail-open](require-access-fail-open.md) for why, and [owner-access-sign-in](owner-access-sign-in.md) for the one place this opening must never be reused).

This deliberately is **NOT** the dormant `rbac.ts` AppRole/users-table system (`packages/core/src/rbac.ts`). Tested in `packages/core/src/access.test.ts` (20 tests). Shipped with the defect-claim flow, PR #95.

## Capability gates

- `canReviewClaim` = super_admin + mechanic (a claim needs a mechanic's judgment)
- `canReviewPayment` = super_admin + admin — **never mechanic**
- Zone-A (primary action block on `/orders/:id`): claim approve/reject renders for super_admin + mechanic, plain admin sees it read-only/disabled; COD-pending and slip-review Zone A render for super_admin + admin, mechanic sees it disabled.

**Prod gap:** `MECHANIC_EMAILS` was UNSET in prod as of 1 Aug 2026 ⇒ claims are effectively super-admin-only until the owner runs `wrangler secret put MECHANIC_EMAILS`.

## Slip images: two-tier access (invariant)

Bank-transfer slips are financial PII, so the owner split access (31 Jul 2026):

- **Approve/reject the payment** (the "verifying" review decision) = **any admin** — it is the operational call and must not bottleneck on one person.
- **View the slip IMAGE** = **super_admin only, everywhere it appears** — the order Documents row AND inside the verifying review block. A regular admin can clear a payment without ever seeing the slip.

Mechanism: slip images live under R2 `slip/` and serve **only** through the Access-gated `GET /file/:key` route → core `privateFileAccess` (in `packages/core/src/access.ts`) → keys matching `slip/` require `isSuperAdmin` (env `SUPER_ADMIN_EMAILS`; local dev fail-open). The admin UI learns the viewer's status via `GET /orders/:id` returning `viewerIsSuperAdmin`. Reject → a "hold" state (awaiting customer; NO 48-hour auto-expire). Payment flow details in [commerce](../commerce/index.md).

## staffAuth permissions: defined and tested, but MOSTLY NOT ENFORCED (verified 2026-08-24)

`packages/core/src/staffAuth.ts` carries the owner's 2026-08-03 permission matrix — `canManageStaff`,
`canViewFinance`, `canViewSlips`, `canRefund`, `canReviewClaimRole`, `canReviewPaymentRole`,
`canWrite`, `scanModesFor` — and its header comment claims "Every one of these is enforced in the
API". **That claim is false.** A repo-wide search on 2026-08-24 found exactly two enforced:

| Helper | Enforced? |
| --- | --- |
| `canManageStaff` | YES — every handler in `apps/api/src/staffRoutes.ts` re-checks it |
| `canDeleteProduct` | YES — `DELETE /products/:id` in `index.ts` (added 2026-08-24) |
| `canViewFinance` | YES — every `/finance/*` route (added 2026-08-24) |
| `canRefund` | YES — `/(orders\|claims\|sales)/:id/refund` (added 2026-08-24) |
| `canWrite` | YES — every non-GET on `/products*` and `/customers*` (added 2026-08-24) |
| `canReviewPaymentRole` | YES — `PATCH /orders/:id` when the body carries `paymentStatus` (added 2026-08-24) |
| `canViewSlips` | YES — `GET /file/:key` for `slip/` keys, and `viewerIsSuperAdmin` on `GET /orders/:id` (added 2026-08-24) |
| `canEditPrice` | YES — `PUT /products/:id/pricing` (added 2026-08-24) |
| `canSeeProfit` | YES — `GET /products` withholds `itemCostSatang` (added 2026-08-24) |
| `canReviewClaimRole`, `scanModesFor` | **NO — defined, unit-tested, never called outside tests** |

Slip-image gating is real but runs on the *older* `isSuperAdmin` email-list path above, not on
`canViewSlips`. Treat a green permission test as proof the FUNCTION is right, never as proof the
RULE is applied — grep for the call site before believing any capability is enforced.

## Why the new gates read the STAFF SESSION, not the Access email

Two identity systems now coexist, and they answer different questions:

| | Old — Access email list | New — staff session |
| --- | --- | --- |
| Identity | Cloudflare Access JWT email | `X-Staff-Session` → `users` row |
| Roles from | `SUPER_ADMIN_EMAILS` / `MECHANIC_EMAILS` env | `users.role` |
| Fails open? | **YES** — `isSuperAdmin`/`viewerRole` return full access when `ACCESS_AUD` is unset | No |

Since per-staff logins shipped, the Access email says who opened the *host*, not who is operating
the admin — several people can share one Access session and then sign in as different staff. And
`MECHANIC_EMAILS` is UNSET in prod, so the email lists **cannot recognise a mechanic at all**,
which makes every "a mechanic may not…" rule unenforceable on that path. All gates added on
2026-08-24 therefore use `requireStaff` (`apps/api/src/index.ts`, helper `requireRole`).

The refund routes keep their older `isSuperAdmin` email check as well — both must pass. Nothing was
removed; a second, non-fail-open check was added in front.

**Slip images migrated 2026-08-24** (owner: "the rule is right, then just make it update"). The
rule itself is unchanged — approve/reject a payment is any admin's call, the slip IMAGE is the
super admin's alone — only the identity moved. `privateFileAccess(key, canSeeSlips)` now takes a
capability instead of an email context, so core no longer knows about env lists, and the route
supplies `canViewSlips(actor.role)` from the staff session. `viewerIsSuperAdmin` on
`GET /orders/:id` moved with it (it gates the UI's slip preview AND redacts the customer's refund
bank details); it resolves the session OPTIONALLY and defaults to false, so an order still renders
but carries less.

**This removed a real fail-open**: the old `privateFileAccess` answered "ok" for a bank slip
whenever `ACCESS_AUD` was unset, serving customer financial PII to an unauthenticated caller.

**Still on the old path (not migrated):** claim review via `canReviewClaim`, and `viewerRole` in
`GET /orders/:id`, which shapes Zone A. Deliberate — `MECHANIC_EMAILS` being unset in prod makes
claim review effectively super-admin-only today, so migrating `viewerRole` to staff roles would
silently GRANT mechanics claim review. That is a behaviour change, not a refactor; ask first.

## Deleting a product: super admin only (owner, 2026-08-24)

`canDeleteProduct(role)` is `role === "super_admin"` — deliberately **stricter than
`canWrite(role, "products")`**, which an admin passes. Editing is day-to-day catalog work; deleting
archives the row, every list filters archived rows out, and **no screen restores it**, so undoing
one means hand-editing D1.

Enforced in `apps/api/src/index.ts` on `DELETE /products/:id` via `requireStaff` → 401 with no
session, 403 for admin/mechanic. The admin UI mirrors it by rendering `DeleteProductCard` only for
a super admin (via the new `StaffRoleProvider` context) — a hidden control is a courtesy, the
Worker's refusal is the permission. Four route tests cover super_admin / admin / mechanic / no
session against the real migrated schema.

## The other role system (status: stale? — verify before relying on it)

As of 2026-07-27: `resolveActor(db, email, …)` (in `apps/api/src/auth.ts`, re-exported from `index.ts`) maps an Access email → a role from the set owner/manager/stock_operator/finance_viewer (seen in tests), **but those roles were not enforced in the UI**, and an RBAC-enforcement finding was explicitly **REJECTED** in the Jul-26 bug hunt. The admin then sat behind ONE shared Access login (owner + mom); `AccessClaims` (JWT) already carries the verified email. Any staff/RBAC build must reconcile with this existing role set or replace it deliberately — see [staff-mechanic-section-plan](staff-mechanic-section-plan.md). This snapshot predates the staff-login work that has since shipped ([staff-login-and-lockout](staff-login-and-lockout.md)); re-verify against current code.

## References

- `packages/core/src/access.ts`, `packages/core/src/access.test.ts`, `packages/core/src/rbac.ts` (dormant)
- `apps/api/src/auth.ts` — `resolveActor`, `requireRole`
- PR #95

## The product table by role (owner, 2026-08-24)

| | Mechanic | Admin | Super admin |
| --- | --- | --- | --- |
| Tabs | **All only** | all | all |
| Open a product | view page only | view + edit | view + edit |
| Edit anything | **no** | yes | yes |
| Stock pencil / row Edit | **hidden** | shown | shown |
| See profit | **no** | yes | yes |
| Change a price | no | **no** | yes |
| Set a price when ADDING | no | **yes** | yes |
| Pause on a channel · delete | no | no | yes |

**Profit is hidden by withholding COST, not by blanking a number.** `GET /products` sends
`itemCostSatang: 0` to a mechanic. The page computes profit as price minus cost, so shipping the
cost and hiding the answer would be decoration — anyone reading the response could subtract. Selling
prices still go through; those are not secret.

**An admin may price a NEW product but not re-price an existing one** (owner's choice: A1). Adding
goes through `POST /products/full`; changing goes through `PUT /products/:id/pricing`, which
`canEditPrice` refuses. On the edit page the price fields render as **plain body-coloured text, not
disabled inputs** (owner: "plain black text") — a greyed box reads as broken or switch-on-able,
text reads as a fact. The VAT-on-cost toggle is read-only with them: it changes the cost the margins
are figured from, so leaving it flippable would let an admin make a change that fails on save.

### The server-side session trap this exposed

Role-shaped responses broke the moment a SERVER component asked for them: `apiFetch` forwarded only
the Cloudflare Access JWT, never the staff session, so a server-rendered page reached the API with
no identity and every role-gated response degraded to its most restricted form — the owner's own
products page would have arrived with cost stripped. `apiFetch` now forwards the staff cookie as
`X-Staff-Session`, the same translation the browser proxy does. **Any future role-shaped GET
depends on this.**
