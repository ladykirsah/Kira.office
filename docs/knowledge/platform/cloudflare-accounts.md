---
type: infrastructure
title: Cloudflare accounts, identities, and API access
description: The GoGoCash account everything lives on, the owner's three CF accounts, the lady.kirsah operational identity, and the wrangler OAuth token's permission split
tags: [cloudflare, accounts, identity, wrangler, api-token, dns]
timestamp: 2026-08-09
status: live
sources: ["default-email.md", "single-domain-airplusauto-move.md", "airplus-domain-options-2026-07.md", wrangler.jsonc]
---

# Cloudflare accounts, identities, and API access

## The account: GoGoCash

Everything deployable — all three Workers, both D1 databases, KV, R2, the `airplusauto.com` and `homeseeker.me` zones, and the Cloudflare Access team — lives on the **GoGoCash** Cloudflare account, `account_id 187ab61ed9dbc6e616cb23e6b95aa8f1` (non-secret; pinned in every wrangler config so CI deploys don't fail with "unable to select one in non-interactive mode" when the token can see multiple accounts).

The owner has **three** Cloudflare accounts: GoGoCash, homeseeker (the old account, `8724aa41…`, where the admin once lived — cause of the cross-account proxy 1003 failure), and Lady.kirsah@gmail.com's. Anything new (domains especially) must land on GoGoCash: **a Worker can only bind a custom domain from a zone in its own account.** Buying a domain on the wrong account means migrating the zone. This is exactly why `airplusauto.com` had to be bought on GoGoCash — see [domains](domains.md).

The Cloudflare Access team domain is `gogocash.cloudflareaccess.com` (team domain, not a zone) — logins are unaffected by which product domains exist. Access details: [auth](../auth/index.md).

## Operational identity

- **lady.kirsah@gmail.com** is the default identity for everything operational: git config, GitHub (`gh` CLI login = `ladykirsah`), wrangler OAuth (= lady.kirsah), Cloudflare GoGoCash access, deploy identities, and any form asking for an email — unless the owner specifies otherwise for a specific action. (Stated 2026-07-09.)
- **fronk.kunanon@gmail.com** is ONLY the Claude account; do not use it for infra.

## The wrangler OAuth token's permission split (explains every dead end)

The wrangler OAuth token (`~/Library/Preferences/.wrangler/config/default.toml`) **CAN** write Worker routes and custom domains but **CANNOT** write DNS or read/write Access — both fail with `10000 Authentication error`. When an Access or DNS operation through wrangler mysteriously fails, this split is why; use the dashboard or a scoped API token instead. Separately verify (standing checklist item from the domain purchase): the **CI deploy token** (`CLOUDFLARE_API_TOKEN`) must have DNS-edit on any new zone — a green deploy has silently lied in this repo before ([operations](../operations/index.md)).

## Attaching a custom domain: the dashboard lies, the API works

The Workers dashboard "Add Domain" / "Add Route" dialogs both failed with *"No zones match api.airplusauto.com"* even though the zone was on the same account — misleading message, the zone was fine. What worked:

```
PUT /accounts/{acc}/workers/domains
{ "environment": ..., "hostname": ..., "service": ..., "zone_id": ... }
```

This provisions the DNS record AND the certificate. Cert provisioning took ~10 min for `api.` (curl returned 000 the whole time, then fine); `admin.` was instant — **don't panic during the window.**

Note also: `wrangler deploy` with `custom_domain: true` route patterns provisions DNS + cert itself, provided the token has zone DNS/Workers-routes edit.

## References

- Worker configs and bindings: [three-workers](three-workers.md)
- Hostname map and domain history: [domains](domains.md)
