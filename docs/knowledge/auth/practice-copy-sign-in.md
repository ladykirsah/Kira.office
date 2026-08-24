---
type: guide
title: The practice copy's passwordless sign-in
description: Why a local practice copy lets you in with one click, and the two conditions that make it impossible in production
tags: [auth, login, local-dev, practice-copy, gate]
timestamp: 2026-08-24
status: live
sources:
  [
    packages/core/src/practiceCopyGate.ts,
    apps/api/src/staffSession.ts,
    apps/admin/src/app/login/LoginForm.tsx,
    wrangler.jsonc,
  ]
---

# The practice copy's passwordless sign-in

## Why

A local practice copy carries **its own users table and its own password for the same email
address**, behind a login screen identical to production's. On 24 Aug 2026 that locked the owner out
of their own practice copy twice — the second time with the "PRACTICE COPY" banner already on
screen, because knowing *why* you are locked out does not unlock anything.

A password on that database protects nothing: it is empty by design (migrations, no seed script),
it holds no real data, and the real shop is a different host behind a different gate. So the login
page offers **Sign in to the practice copy**, above the form, and it needs no credential.

## The gate

`isPracticeCopy(env)` — **two conditions, both required**:

1. **`PRACTICE_COPY === "1"`.** Production does not merely leave this unset. It ships `"0"`
   explicitly in `wrangler.jsonc`'s deployed `vars`, top level and every named env. An absent
   variable means "nobody happened to set it"; an explicit `"0"` means "this deployment refuses".
   `.dev.vars` overrides it to `"1"` locally and is gitignored, so it never travels.
2. **Cloudflare Access not configured.** Anything behind Access is by definition the real one.

`configDeniesPracticeCopy()` is asserted **against the real `wrangler.jsonc`** by a test, in the
same spirit as the BACKUP_TABLES drift test: adding a new deployable environment without
`"vars": { "PRACTICE_COPY": "0" }` fails the build.

Note the shape. `requireAccess` reads "ACCESS_* unset" as permission to proceed, and `viewerRole`
once read an unconfigured environment as super_admin — both **fail open** when configuration goes
missing. Nothing here opens because something is absent: condition 2 can only refuse, and the only
thing that grants is a value somebody had to deliberately write down.

## There is deliberately NO hostname check

The obvious third condition — "only on localhost" — **cannot be made correct**, and this was
verified empirically rather than assumed:

> `wrangler dev` rewrites **both `request.url` and the `Host` header** to the Worker's first
> configured route. Locally this Worker sees `api.homeseeker.me` — a genuine production hostname.

So inside the Worker there is no signal separating local from deployed, and any allowlist that made
the local case work would have to admit a real production host. A guard that cannot be made correct
is worse than none, because it gets trusted without being load-bearing. Do not re-add one without
re-checking that claim.

## What the route does

`POST /staff/login-practice` → `signInToPracticeCopy()`:

- signs in as the **earliest active super admin**, so repeated sign-ins land on the same person;
- **creates one** if there is none — a fresh practice copy has no users at all, which is exactly
  when a way in matters most;
- refuses with **404**, not 403, when the gate says no: outside a practice copy the route does not
  exist, so nothing advertises a door worth rattling.

The admin app shows the button when `isLocalHost(window.location.hostname)` — the same detector as
the practice-copy banner. That decides only whether to *draw* a button; the API is the boundary and
refuses regardless of what is drawn.

## Setting it up

Add to `.dev.vars` (gitignored — never `wrangler secret put` this):

```
PRACTICE_COPY=1
```

Restart the API. Declared in `.dev.vars.example`.

Related: [practice-copy-login-confusion](practice-copy-login-confusion.md),
[dead-session-silent-access](dead-session-silent-access.md),
[require-access-fail-open](require-access-fail-open.md),
[owner-access-sign-in](owner-access-sign-in.md).
