# Production Launch Plan

Best-practice plan to take L Shopee Back Office (Kira.office) from its current live API to a
production launch. Decisions are made here (not left open); owner action items are called out with
**[OWNER]**. Authoritative tech facts: [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md),
[DECISIONS.md](DECISIONS.md).

## Where we are (done)

- **API live** at `https://api.homeseeker.me` (Worker `kiraoffice`, homeseeker account), auto-deployed
  from `main` via Workers Builds; GitHub CI green.
- **D1** `kira-office` (APAC) — 16 tables migrated. **KV** bound. **Durable Object** `StockLedger`
  serializes `/sync`. Endpoints: `/health`, `/pricing/preview`, `/products`, idempotent `/sync`
  (verified end-to-end, including idempotency + stock ledger).
- **`packages/core`** — complete domain logic, 100+ tests (pricing/tax/cost/stock/terms/sync/orders/
  imports/finance, refunds, reserved stock, price-from-margin, Shopee delta).

## Launch decision (recommended)

**Phased, local-first launch.** Go live with the on-premise back office (catalog, barcode POS,
pricing/profit, sales + finance) on production now; keep **Shopee sync on the CSV bridge** and switch
on the **live Shopee v2 API only after managed-seller eligibility is confirmed** (Thailand grants API
access mainly to managed sellers — see [SHOPEE_INTEGRATION.md](SHOPEE_INTEGRATION.md)). This delivers
~80% of the value immediately with the lowest risk, and the Shopee boundary makes the later API
switch a no-op for core logic.

## Environments (best practice: staging + production)

Use **two Wrangler environments** with isolated resources so production data is never touched by
tests. Production stays the default (current) deploy; add a staging env.

| Resource | Production (current) | Staging (to add) |
| --- | --- | --- |
| Worker | `kiraoffice` | `kiraoffice-staging` |
| D1 | `kira-office` | `kira-office-staging` |
| KV | `kira-office-kv` | `kira-office-kv-staging` |
| Domain | `api.homeseeker.me` | `api-staging.homeseeker.me` |

Steps: create the staging D1/KV, add `env.staging` blocks to `wrangler.jsonc` (bindings are **not**
inheritable), and a second Workers Builds project (or a non-production branch build) deploying
`--env staging`. Validate every release on staging before it reaches `main`.

## Pre-launch checklist

### Security
- **[OWNER] Gate the admin app with Cloudflare Access** (Zero Trust) — SSO/MFA (email OTP or Google)
  so the back office isn't publicly reachable. The Worker validates the `Cf-Access-Jwt-Assertion`
  header (`AUD` + team domain via env vars). The public `api.homeseeker.me` endpoints that staff hit
  from the POS go behind Access too (service token for the POS device, or Access for the operator).
- **Rate limiting** on `/sync` and any auth endpoints (Cloudflare Rate Limiting rule); **WAF** managed
  rules on the zone; **Turnstile** on any public form.
- **Secrets** via `wrangler secret` / Secrets Store (never `vars`/source): `AUTH_SECRET`, and later
  `SHOPEE_PARTNER_KEY` + refresh tokens (encrypted at rest). Declare required names in `wrangler.jsonc`
  `secrets.required`.
- **[OWNER] Scope the Workers Builds token** to least privilege (Workers Scripts + the specific D1/KV
  + the zone for the custom domain) — it currently has enough to deploy + manage the domain.
- Append-only **audit log** for product/stock/pricing/sales/refund changes before go-live.

### Data
- **D1 backups:** D1 **Time Travel** gives 30-day point-in-time restore automatically; additionally
  schedule a **daily `wrangler d1 export`** (Cron-triggered or CI) to R2 for off-platform backup.
- **Migrations:** all schema changes as a new numbered SQL file in `packages/db/migrations/` →
  `wrangler d1 migrations apply` on staging, then production. Never hand-edit production tables.
- **Money integrity:** stored as integer satang; finance rows store inputs+outputs so historical
  records never shift. Verified reconciliation (`salesExTax + tax === buyerPrice`).

### Observability
- **Workers Logs** enabled (`observability.enabled`); add **Logpush** to R2/external sink for
  retention. **Analytics Engine** for sales/stock/fee metrics queried via SQL.
- **Alerts:** error-rate alert on the Worker; **dead-letter-queue depth** alert once Queues land;
  uptime check on `/health`. Optional **Sentry** for exceptions.

### Performance / reliability
- D1 pinned to **APAC** (Singapore) for Thailand latency; enable D1 **read replication** if read load
  grows. POS is **offline-first** — verify outbox sync + conflict surfacing under flaky network.
- Smoke test the golden path on staging each release: create product → scan/sell offline → sync →
  finance/export.

## Remaining build work (sequenced to launch)

1. **Auth (Cloudflare Access)** — middleware in the Worker + the Access app **[OWNER]**. *(Launch blocker.)*
2. **Admin UI** (`apps/admin`, Next.js on Workers via OpenNext) at `homeseeker.me`/`app.homeseeker.me`
   — product CRUD + image upload, barcode POS (PWA, IndexedDB outbox → `/sync`), pricing/fees, sales
   + finance views + CSV export, Thai T&C editor. *(Largest remaining effort.)*
3. **Catalog import** from the owner's Google Sheet via the ready `mapRows` importer + a `/import` job.
4. **Images** — **[OWNER] enable R2** in the dashboard → wire R2 + Cloudflare Images upload.
5. **Shopee CSV bridge** — order import endpoint + stock export, then **Queues + Cron** for retries/
   polling; **live v2 API gated** on **[OWNER]** confirming managed-seller eligibility + creating the app.
6. **Finance reports + accountant export** (CSV) and the refund/cancellation flows (logic ready).

## Go-live runbook

1. Confirm staging green (CI + smoke test) and Cloudflare Access protecting the admin app.
2. `wrangler d1 migrations apply kira-office` (production) — reviewed.
3. Set production secrets (`wrangler secret put …`).
4. Seed real data: import catalog (Google Sheet), set opening stock, tax + fee profiles.
5. Merge to `main` → Workers Build deploys production.
6. Verify: `/health`, a real product loads, an offline sale syncs, finance export downloads.
7. Announce go-live; monitor logs/alerts for 24–48h.

## Rollback

- **Worker:** redeploy the previous version (Workers Builds keeps history; `wrangler rollback` or
  re-run the prior build). A failed build never replaces the running version.
- **Data:** D1 Time Travel restore to a timestamp before the incident; or restore the latest
  `wrangler d1 export` from R2.
- Migrations are forward-only; ship a compensating migration rather than down-migrating production.

## Owner action items (summary)

- **[OWNER]** Create the **Cloudflare Access** application for the admin app (SSO/MFA).
- **[OWNER]** **Enable R2** in the dashboard (for product images).
- **[OWNER]** Confirm **Shopee Thailand Open API eligibility** (managed seller / KAM) and create the
  v2 app; provide `partner_id` + redirect URL when ready.
- **[OWNER]** Provide the **Google Sheet** export (or access) for the initial catalog import.
- **[OWNER]** Decide the admin-UI hostname (`homeseeker.me` vs `app.homeseeker.me`).
