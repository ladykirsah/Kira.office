---
type: infrastructure
title: Domains and hostnames
description: airplusauto.com is the single domain for all six hosts; homeseeker.me holds three retiring fallbacks and can lapse; plus the host-derivation and indexability invariants
tags: [domains, dns, airplusauto, homeseeker, cloudflare-registrar, seo]
timestamp: 2026-08-09
status: live
sources: ["airplus-domain-options-2026-07.md", "single-domain-airplusauto-move.md", "homeseeker-domain-dependency.md"]
---

# Domains and hostnames

## The decision (2026-07-17)

The owner bought **airplusauto.com** via Cloudflare Registrar (~$11.25 ≈ ฿378/yr at-cost, free WHOIS privacy; registrant = บริษัท เด่นแอร์ เซอร์วิส จำกัด — Den Air Service Co., Ltd., the data controller named in the policies). It **must** live on the GoGoCash account (`187ab61ed9dbc6e616cb23e6b95aa8f1`): a Worker can only bind a custom domain from a zone in its own account, and `airplus-storefront` lives there. Buying via CF Registrar auto-created the zone + nameservers.

Rejected options: `airplus.parts` (฿537, decent but Thai buyers are .com/.co.th-conditioned), `airplus.asia` (promo bait, weak TLD), `airplus.cars` ($2,300). Bare "airplus" is gone on every mainstream TLD.

**Standing warning:** ฿67/฿100 first-year TLD promos (.shop/.store/.online/.site/.asia) renew at 3–5× the .com price — say so plainly if they resurface.

**Untested strong option:** `.co.th` — the owner qualifies via the registered Thai company; signals legitimacy to Thai buyers; needs a THNIC registrar + company paperwork, takes days.

Post-purchase checklist (recorded at decision time; the routes/deploy items are done, verify the rest): replace the `www.airplusshop.xxx` placeholder in `docs/policies/*`; serve apex + redirect www; **verify the CI deploy token has DNS-edit on the new zone** (a green deploy has silently lied in this repo before — [operations](../operations/index.md)).

## Current hostname map (live since PR #44, 2026-07-21; staging hosts PR #57, 2026-07-22)

| Hostname | Worker | Gate |
|---|---|---|
| `airplusauto.com` | airplus-storefront | public |
| `api.airplusauto.com` | kiraoffice | `requireAccess` in code (`/health` public, `/products` 401, `/img/*` 404-not-401) |
| `admin.airplusauto.com` | kiraoffice-admin | Cloudflare Access (302, aud `dfcb79fc…`) |
| `staging-shop.airplusauto.com` | airplus-storefront-staging | public + noindex, 6/6 security headers |
| `staging-api.airplusauto.com` | kira-office-staging | gated (401), `/health` public |
| `staging-admin.airplusauto.com` | kiraoffice-admin-staging | 302 → Access (same "admin" app), 0 markup pre-login |

## homeseeker.me CAN lapse

`homeseeker.me` carries ONLY retiring fallbacks — `api.homeseeker.me` (a zone **Route**), `admin.homeseeker.me`, `staging-admin.homeseeker.me` — kept so old bookmarks work. The apex already does not resolve; `staging-api.homeseeker.me` returns a cosmetic Cloudflare 530. The domain can lapse once the owner confirms they use airplusauto.com URLs; removing the three routes is then a config edit + deploy, **no Access change** (the Access team domain is `gogocash.cloudflareaccess.com`, not the zone, so logins are unaffected by product domains).

Why the old hostnames deliberately still answer: nothing goes dark mid-migration and rollback is a redeploy, not a DNS change.

The single-domain move (PR #44, commit `7629818`) also switched two compiled-in defaults behind `NEXT_PUBLIC_*` vars: `apiBase` in `apps/admin/src/lib/apiFetch.ts` and `IMG_BASE` in `apps/storefront/src/lib/img.ts`. All 9 homepage images were verified 200 on the new host, and the same keys still 200 on the old host.

## Invariants & traps

### `isIndexableHost` is an EXACT-match allow-list on purpose (pinned by test)

Staging stayed noindex through the domain move for free because `isIndexableHost` exact-matches the indexable host — `staging-shop.airplusauto.com`, a *subdomain* of the indexable host, is refused. A suffix check would have silently begun indexing staging. A test now pins the exact-match behaviour; do not "generalise" it.

### Zone Routes don't appear in `workers/domains`

`api.homeseeker.me` is served by a zone ROUTE, not a custom domain, so it never appears in the `GET /accounts/{acc}/workers/domains` list while still answering. Don't panic when it's missing from that listing.

### Derive URLs from the request, never hardcode a hostname (PR #56)

The api Worker's root page linked to `https://app.homeseeker.me` — a hostname with **no DNS record that never existed** — dead for as long as it was there, because a wrong link on a cosmetic page fails silently. `DEFAULT_CORS_ORIGINS` listed the same phantom. Fixed: `adminUrlForApiHost` derives the admin URL from the request (`api.<zone>` → `admin.<zone>`, `staging-api.<zone>` → `staging-admin.<zone>`) so it survives any future domain change. Follow that pattern for any new cross-app URL.

### Custom-domain attach mechanics

The dashboard dialogs fail misleadingly; use the API. See [cloudflare-accounts](cloudflare-accounts.md) for the `PUT /workers/domains` recipe, the cert-provisioning wait, and the wrangler-token permission split.

## References

- Worker-side route config (including the staging `"routes": []` load-bearing rule): [three-workers](three-workers.md)
- Access apps and destination-REPLACE trap: [auth](../auth/index.md)
