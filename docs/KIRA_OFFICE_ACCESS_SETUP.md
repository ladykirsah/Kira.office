# Kira.office (admin) — go-live via Cloudflare Access

Goal: host the **admin back office** at **`admin.homeseeker.me`**, reachable only by the owner,
logging in with an **email one-time code**. Independent of the AirPlus storefront launch.

> **Owner decisions (2026-07-18):**
> - Login method: **Email one-time PIN**.
> - **Super admin = `lady.kirsah@gmail.com`** only. Nobody else may enter. App role: **`owner`**.
> - Admin domain: **`admin.homeseeker.me`**.
> - **Everything on the GoGoCash account** (`187ab61ed9dbc6e616cb23e6b95aa8f1`).

## Account topology — the thing that was wrong, now fixed

Verified 2026-07-18: `api.homeseeker.me` is served by the **GoGoCash** worker (HTTP 200), which means
the **live `homeseeker.me` zone is on GoGoCash**, together with the API and the storefront. The admin
worker used to sit on a *separate* `homeseeker` account — that split is the documented "1003
cross-account proxy" failure. `apps/admin/wrangler.jsonc` now points the admin at **GoGoCash** with a
`admin.homeseeker.me` custom domain, so admin + API + storefront + DNS + Access are all one account.

**Cloudflare Access is per-account, so ALL of this happens on the GoGoCash account's Zero Trust** —
NOT the `homeseeker` account. (The `kiraoffice.cloudflareaccess.com` team domain created on the
homeseeker account is on the wrong account and won't be used.)

## The security model

- **No password.** The `users` table has no password column. Access emails a 6-digit code to an
  allow-listed address. Nothing to store or leak.
- **"Invite an admin" = add their email to the Access policy** (+ seed a `users` row for their role).
- **Access must cover the API too**, or someone could hit the open API directly, bypassing the UI.
- **⚠️ KEEP `/img/*` PUBLIC.** The storefront loads every product image from `api.homeseeker.me/img/*`
  with no login. Access blocks at the edge before the API's own `isPublic` check runs, so the policy
  must **Bypass** `/img/*` or every storefront photo 403s.

## Order matters — configure Access BEFORE deploying, so the admin is never briefly open

An Access application is created by hostname; the hostname does not need to resolve yet. So we set up
Access for `admin.homeseeker.me` FIRST, then deploy the admin into it — it is behind login from its
first request. Deploying first would leave an unauthenticated back office public for a window.

---

## Steps (all on the GoGoCash account)

### 1. Create the Access application for the admin  — [OWNER, dashboard]
Switch the dashboard to the **GoGoCash** account (top-left account picker). Open **Zero Trust →
Access controls**. If prompted, pick a **team name** (this becomes `<name>.cloudflareaccess.com` — the
GoGoCash team domain; reuse `kiraoffice` if free, or `airplus`).
- **Create an application → Self-hosted.**
- Application domain: **`admin.homeseeker.me`**.
- **Login method: One-time PIN.**
- Policy → **Allow**, rule **Emails**, value `lady.kirsah@gmail.com`. Nothing else.
- Save, then open the app → copy its **Application Audience (AUD) Tag**, and note the **team domain**.
- **→ Send me the AUD tag + team domain.** (Both are config identifiers, safe to paste — not credentials.)

### 2. Create the two Access applications for the API  — [OWNER, dashboard]
On `api.homeseeker.me`, most-specific path first:
- **Bypass app:** `api.homeseeker.me/img/*` → policy **Bypass**, **Everyone**. (Keeps images public.)
- **Protected app:** `api.homeseeker.me/*` → **One-time PIN**, **Allow → Emails → `lady.kirsah@gmail.com`**.

### 3. Set the Worker secrets on the API  — [after AUD received]
```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler secret put ACCESS_TEAM_DOMAIN   # <team>.cloudflareaccess.com
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler secret put ACCESS_AUD           # the AUD tag
```
Now `requireAccess` verifies the JWT on every non-`/img/*` request. **This is the point the localhost
admin stops working** (it calls the open API with no Access session) — from here you use
`admin.homeseeker.me`, not localhost.

### 4. Deploy the admin to GoGoCash  — [needs a GoGoCash Workers-edit token]
The admin is now a GoGoCash worker, so the **existing** `CLOUDFLARE_API_TOKEN` (already a GoGoCash
token for the API) can deploy it — `CF_ADMIN_API_TOKEN` may no longer be needed.
`npm run deploy -w @l-shopee/admin` (OpenNext build + deploy). The `admin.homeseeker.me` custom domain
provisions same-account. It is behind Access from its first request (step 1).

### 5. Seed the owner row  — [additive, R1]
```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler d1 execute kira-office --remote --command \
  "INSERT INTO users (id,name,email,role,status,created_at) VALUES ('<uuid>','Lady Kirsah','lady.kirsah@gmail.com','owner','active',strftime('%s','now')*1000);"
```
`<uuid>`: `uuidgen | tr A-Z a-z`. No password — email + role only.

### 6. Verify directly (no staging domain needed for the checks)
- `curl -I https://api.homeseeker.me/img/<any-key>` → **200** (image still public — storefront safe).
- `curl -I https://api.homeseeker.me/products` → **401/302** (API now gated).
- Open `admin.homeseeker.me` in a fresh browser → Access asks for the email code → enter → admin loads.
- Confirm the admin can list products (exercises the now-same-account admin→api proxy).

## Rollback
- Delete the Access applications → edge stops gating.
- `wrangler secret delete ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` → `requireAccess` fails open again.
- The localhost admin keeps working throughout (localhost is never behind Access).

## Not needed yet — role enforcement
`resolveActor`/`requireRole`/`canPerform` are built + tested but unwired. With one allow-listed email,
everyone who gets in IS the owner. Wire them the day a SECOND, lesser admin is invited.
