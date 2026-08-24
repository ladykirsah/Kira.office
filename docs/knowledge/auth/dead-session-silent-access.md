---
type: incident
title: A dead session bought a silent, nameless back office (24 Aug 2026)
description: Why a cookie outliving its session let anyone browse the whole admin as nobody, with no redirect and no message, and the gate that now stops it
tags: [incident, login, session, middleware, gate, admin, diagnosis]
timestamp: 2026-08-24
status: live
sources:
  [
    session 2026-08-24,
    apps/admin/src/middleware.ts,
    apps/admin/src/app/layout.tsx,
    apps/admin/src/lib/signedInGate.ts,
  ]
---

# A dead session bought a silent, nameless back office (24 Aug 2026)

## What happened

Verifying the admin permission work, an assistant signed the owner's preview browser in as a
throwaway `admin` user, then deleted that user afterwards. The owner opened the same window and saw
**"Test admin — Admin"** in the top bar and asked, reasonably, why their super-admin account had
been demoted.

It had not. But the screen could not have told them that, and the reason is a real defect.

## The defect

Two things decide whether the back office is drawn, and they disagreed.

| | Knows | Verdict on a dead cookie |
| --- | --- | --- |
| `middleware.ts` | only that a cookie **exists** — it has no database | "signed in", pass |
| root layout (`currentStaff()` → API `/staff/me`) | who the token actually belongs to | "nobody" |

The middleware won, because it ran first and nothing downstream acted on the layout's answer. So a
cookie whose session had been **revoked, expired, or whose user had been deleted** produced:

- every page rendering in full;
- an **empty** space where the name badge goes;
- **no redirect**, and **no message**.

There was no way to tell "signed in as myself", "signed in as someone else", and "not signed in at
all" apart. The owner's screenshot was the third case wearing the clothes of the second — a page
rendered while the throwaway session was still alive, never re-fetched.

**This was not a data leak.** In production `api.airplusauto.com` refuses every request without a
valid session (`requireStaff`), and the admin host sits behind Cloudflare Access, so the pages a
nameless visitor reached were empty shells. What was lost was the ability to know who you were.

## The fix

The layout already fetches the truth once per request. It now acts on it.

- **`lib/signedInGate.ts`** (new) — `mustSignIn(path, signedIn)`, the whole decision, unit-tested.
  Renders when signed in; renders when the path is `null` (assets and the login route handlers,
  which the middleware does not match); renders on `/login` and beneath it, so there is no loop;
  otherwise demands a sign-in. `/loginhelp` and `/products/login-cable` are **not** the login page —
  a bare `startsWith("/login")` would have waved both through.
- **`middleware.ts`** — unchanged as a gate, but now stamps the pathname into `x-kira-path` so the
  layout knows what it is about to draw. Set with `headers.set`, never appended, so a caller cannot
  supply their own.
- **`app/layout.tsx`** — `if (mustSignIn(path, staff !== null)) redirect("/login?expired=1&next=…")`.
- **`app/login/`** — says **"You were signed out. Please sign in again."**, and clears the dead
  cookie on arrival so the browser and the API stop disagreeing.

Why not make the middleware verify? It would add an API round trip to every navigation and still
not be the thing standing between the internet and D1. The cheap first pass plus one authoritative
check, on a fetch that was already happening, costs nothing extra.

## `?next=` was a promise the code did not keep

The middleware has recorded `?next=` since it was written, and its comment has always claimed
signing in returns you there. Both sign-in paths navigated to `"/"` regardless, and the login page's
"send them where they were going" did the same. Fixed in the same pass — which makes the value
attacker-reachable, so `safeNextPath` now rejects anything that is not a path on this site:
`//host`, `/\host`, absolute URLs, and anything without a leading slash all collapse to `/`.

## Verified

With the cookie held and the session revoked, `/`, `/products`, `/orders` and `/finance/summary`
all land on `/login?expired=1&next=…`, show the notice, and render zero rows — against 8 product
rows and a 200 before the fix. Signed in, `/products` renders with **Lady Kirsah / Super admin**;
`/login` bounces to `/`; `/login?next=/orders` bounces to `/orders`; `next=https://evil.example` and
`next=//evil.example` both collapse to `/`. The login page itself redirects zero times.

## The lesson

A cheap check and an authoritative check are fine together — but only one of them may decide, and
it must be the authoritative one. When the cheap check is allowed to win, the failure is not an
error message; it is a screen that looks completely normal and is quietly wrong.

Related: [staff-login-and-lockout](staff-login-and-lockout.md),
[practice-copy-login-confusion](practice-copy-login-confusion.md),
[require-access-fail-open](require-access-fail-open.md).
