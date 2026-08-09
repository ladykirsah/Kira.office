---
type: infrastructure
title: Staging stack
description: The three staging Workers, why workers.dev is permanently off, the storefront staging redeploy recipe with its six gotchas, and the staging D1's Frankenstein state
tags: [staging, workers, otp, access, d1, seed-data]
timestamp: 2026-08-09
status: live
sources: ["airplus-staging-preview.md", "kira-staging-blocked-on-access.md", apps/storefront/wrangler.jsonc, apps/admin/wrangler.jsonc, wrangler.jsonc]
---

# Staging stack

Three staging Workers, all named envs (`--env staging`) of the production configs, all on GoGoCash, all with `workers_dev: false`:

| Env name | Hostname | Gate |
|---|---|---|
| `kira-office-staging` (API) | `staging-api.airplusauto.com` | code-level auth (401; `/health` public) |
| `kiraoffice-admin-staging` | `staging-admin.airplusauto.com` (+ retiring `staging-admin.homeseeker.me`) | Cloudflare Access ("admin" app, aud `dfcb79fc…`) |
| `airplus-storefront-staging` | `staging-shop.airplusauto.com` | **public**, noindex |

Staging has its own D1 (`kira-office-staging`, id `85f22f44-063d-424e-91ef-39e1fa1fef24`), KV (`c876509fba5c40608e1c0f1abf5d4502`), and R2 (`kiraoffice-images-staging`).

## Why workers.dev is off — permanently (2026-07-21)

Both staging workers had workers.dev disabled via `POST /accounts/{acc}/workers/scripts/{script}/subdomain {enabled:false}`; the old URLs (`airplus-storefront-staging.bettergogocash.workers.dev`, `kira-office-staging.bettergogocash.workers.dev`) 404 now. Why: the staging storefront was publicly reachable AND ran `OTP_DEV_ECHO=1`, so the login code was a fixed `123456` — anyone who found the URL could log in as ANY phone number and read that customer's staging data (which holds real-looking Thai mobiles). The staging API was fine (all endpoints returned unauthorized); the storefront was the hole.

Structural reason it can never come back: **`*.workers.dev` cannot be put behind Cloudflare Access at all** — Access can only protect hostnames on your own zone. That is why PR #43 (staging-shop custom domain) exists. If a login-testable staging is ever needed again, put an Access app on the hostname BEFORE attaching it; do not re-enable workers.dev.

### OTP_DEV_ECHO history — do NOT re-add

`OTP_DEV_ECHO: "1"` was set in `apps/storefront/wrangler.jsonc` `env.staging.vars` ONLY (never default/prod), because staging has no SMS provider — OTP was a fixed `123456` echoed to the UI. It has since been **deliberately removed** from the config (the config comment says so explicitly) because staging now sits on a public hostname. With no SMS provider, login on staging simply does not complete; the catalogue stays fully browsable, which is what staging is for. Removing the need entirely waits on `THAIBULKSMS_*` being configured.

While the mock login existed, the owner reset it (2026-07-13) to a single account: phone `0123456789`, name "L", PDPA-consented + verified, one default address; every other number triggered the new-member/consent flow. This replaced an older multi-account demo (deleted). Reset SQL lived at `scratchpad/reset-single-mock-account.sql` (idempotent, upsert-based — scratchpad files are session-scoped, so treat it as gone). Reset gotchas that remain true for any staging-D1 surgery: **remote D1 enforces FKs** (the local sqlite3 CLI does NOT) — before `DELETE FROM storefront_customers`, clear `storefront_sessions`, `coupon_redemptions`, `addresses`, AND null BOTH `sales_orders.storefront_customer_id` and `sales_orders.shipping_address_id` (migration 0039 added the shipping_address_id FK).

## Storefront staging redeploy recipe + the six gotchas

From `apps/storefront`, with `CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1` and `NEXT_PUBLIC_IMG_BASE=<staging API URL>`:

```
rm -rf .next .open-next && npx opennextjs-cloudflare build && npx wrangler deploy --env staging
```

1. **Clean-build in isolation** — building while `next dev` runs on the same `.next` corrupts route outputs (`products/[id]` and `/tools` 404'd).
2. Root `wrangler.jsonc` `env.staging` has `"routes": []`-style explicit routes so staging deploys can't steal the prod custom domain — KEEP the explicit arrays (full trap in [three-workers](three-workers.md)).
3. `NEXT_PUBLIC_IMG_BASE` is baked at **build** time.
4. zsh: never use `path` as a loop variable (it is bound to `$PATH`).
5. The staging API worker inherits the daily backup cron (`0 19 * * *`) — harmless, no `BACKUPS` bucket bound.
6. **Every D1-reading page MUST `export const dynamic = "force-dynamic"`** — otherwise `next build` statically prerenders and dies with `D1_ERROR: no such table`; `next dev` hides this, only the clean build catches it. (Full rendering rules: [storefront-architecture](storefront-architecture.md).)

Admin staging build has the same baked-var rule: `NEXT_PUBLIC_API_BASE=<staging api> npx opennextjs-cloudflare build`, then `opennextjs-cloudflare deploy -- --env staging`.

## Staging D1 contents (status: stale? — re-verify before relying)

As of the 2026-07-18 deploy (version `6c287c32`, from branch `claude/airplus-publication-plan-08e4c7`), staging D1 carried BOTH the returns migrations (0048–0050) AND the launch ones (0053–0055) — a functional **Frankenstein schema**; launch code ignores the unused returns columns. Given prod is now at migration 0087, this snapshot is old — check `wrangler d1 migrations list` against staging before assuming anything.

Seed rows a fresh reseed of the 6-product catalog does NOT include (re-apply after any wipe):

- The 3 banner KV/R2 keys: `/banners/hero-1.png`, `hero-2.png`, `promo-1.png` — the owner's real PNGs are bundled in `apps/storefront/public/banners/`.
- Best-seller demo orders (`seed-so-bs1..5` + `seed-sol-bs1..5`, channel `airplus`, within 90d) that drive ยอดขายเฉลี่ยต่อเดือน (average monthly sales).
- Flash `campaign_prices.sold_count` tuning.
- Two renamed `product_types`: `seed-type-evap`→คอยล์เย็น (evaporator coil), `seed-type-cond`→คอยล์ร้อน (condenser coil) — `PART_TYPE_EN` in code is keyed by these Thai names.
- Demo account rows.
- The demo flash campaign is PERMANENT by owner request: `seed-camp-1` window 2025-01-01→2028-01-01 (`starts_at=1735689600000`, `ends_at=1830297600000`, `status='active'`) so the flash hero/sale collection/PDP campaign prices always render; the Countdown "boxes" variant shows an "N วัน" (N days) chip for >24h windows.

LINE Login on staging needs 2 owner steps: register the staging callback URL in the LINE channel + set `LINE_CHANNEL_SECRET` on the `airplus-storefront-staging` worker.

## References

- Hostname map + why old hostnames still answer: [domains](domains.md)
- Databases: [d1-and-migrations](d1-and-migrations.md)
- Access apps: [auth](../auth/index.md)
