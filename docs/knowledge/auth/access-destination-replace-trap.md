---
type: trap
title: Access destination edit REPLACES — it silently unprotects the old hostname
description: Moving domains on an Access app must be add-then-verify, never edit-in-place
tags: [cloudflare-access, zero-trust, domains, incident, trap]
timestamp: 2026-08-09
status: live
sources: [access-destination-replace-trap.md, apps/admin/wrangler.jsonc]
---

# Access destination REPLACE trap

## The trap

Access destinations are a **list** per application. Editing an existing hostname row **rewrites that row** — the old hostname is silently unprotected, with no warning; the dashboard cheerfully reports "Application successfully configured".

To move or add domains: click **"+ Add public hostname"** (up to 5 per app) and **leave the old row alone**.

## Verification after any destination change

1. `curl -sI https://<old-host>/` must still **302** to `…cloudflareaccess.com/cdn-cgi/access/login/…`. A **200 is the alarm.**
2. Check the `kid=` in the redirect matches `ACCESS_AUD`: same app = same JWT audience, nothing to re-wire. A **new** app issues a different AUD and breaks every API call after login ([access-model](access-model.md)).
3. Gate a hostname **BEFORE** attaching it to a Worker route, never after.

## The incident (2026-07-21, ~20:31–20:37 +07)

During the single-domain move to airplusauto.com, `admin.homeseeker.me` served HTTP 200 with **no login challenge for ~6 minutes**. Not a data exposure: the API gates separately in code and kept returning 401 ([require-access-fail-open](require-access-fail-open.md)), so visitors got an admin shell with empty screens. But the window existed only because of this trap.

## The agent cannot fix this

The wrangler OAuth token gets `10000 Authentication error` on the Access API. Access application changes are **always an owner dashboard action**. When this comes up: say so immediately and give the exact click path — do not burn time attempting it via API/wrangler.

## Where this is recorded

In-repo next to the routes in `apps/admin/wrangler.jsonc` (comment), and here. Related domain history lives in [platform](../platform/index.md).

## References

- `apps/admin/wrangler.jsonc`
- [access-model](access-model.md)
