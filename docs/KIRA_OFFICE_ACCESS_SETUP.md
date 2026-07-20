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

**Only ONE Access app is needed — on `admin.homeseeker.me`. Do NOT put edge Access on the API.** The
API worker verifies the forwarded JWT itself (`requireAccess`): the admin's `/api/worker` proxy passes
`Cf-Access-Jwt-Assertion` through, and the worker checks it against `ACCESS_AUD` (= the admin app's
AUD). No API edge app means the `/img/*` bypass is unnecessary — images are never edge-gated, the
worker's `isPublic` serves them, and `requireAccess` 401s everything else. (Edge Access on the API
would instead block the admin proxy's server-side fetches.)

## Values (verified 2026-07-18 — config identifiers, not credentials)
- `ACCESS_TEAM_DOMAIN` = `gogocash.cloudflareaccess.com`
- `ACCESS_AUD` = `dfcb79fcb7c150e7f0e2c3af5b3bbfcfe118eb960fee8c46fa815dd1ad76ea65`

---

## Steps (all on the GoGoCash account)

### 1. Create the Access application for the admin  — [OWNER, dashboard]  ✅ DONE
App `admin` → `admin.homeseeker.me`, policy "Super Admin Only" (Allow → Emails →
`lady.kirsah@gmail.com`, One-time PIN). AUD captured above.
> Verify the policy has **only** the Emails include rule — no "Login Methods" rule (that would be an
> OR-hole letting anyone in via email code).

### 2. Deploy the admin to GoGoCash  — [OWNER — needs a GoGoCash Workers+DNS token]
The agent's wrangler is read-only, so the owner runs this. The admin is now a GoGoCash worker, so a
GoGoCash Workers-edit token (the kind CI uses as `CLOUDFLARE_API_TOKEN`) deploys it:
```
npm ci
CLOUDFLARE_API_TOKEN=<gogocash-workers+dns-token> npm run deploy -w @l-shopee/admin
```
OpenNext build + deploy; the `admin.homeseeker.me` custom domain provisions same-account. It is behind
Access from its first request. The API is still open at this point, so the admin works immediately.

### 3. Log in and verify the admin  — [OWNER]
Open `admin.homeseeker.me` in a fresh browser → Access emails a code → enter it → the admin loads and
can list products (this exercises the admin→api proxy). Do this BEFORE step 4 so you have a working
way in before the API closes.

### 4. Set the Worker secrets on the API  — [OWNER, GoGoCash token]  ✅ DONE 2026-07-20
```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler secret put ACCESS_TEAM_DOMAIN   # gogocash.cloudflareaccess.com
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler secret put ACCESS_AUD           # dfcb79…76ea65
```
Now `requireAccess` verifies the JWT on every non-`/img/*` request. **This closes the open-API hole,
and is the point the localhost admin stops working** — from here use `admin.homeseeker.me`, not localhost.

> ⚠️ **This step had NOT been run until 2026-07-20**, so the API was reachable with no credentials
> for the whole period the admin was live — reads *and* writes (`PUT`/`DELETE /taxonomy-images/…`
> both succeeded unauthenticated). Cause: `requireAccess` **fails OPEN** when either secret is
> missing, and nothing warns about that. Verified closed after setting them: `/products`, `/orders`,
> `/customers`, `/stock/movements`, `/audit-log`, `/settings` → 401; `/health` + `/img/*` still
> public; `airplusauto.com` unaffected.
>
> **Secrets propagate across edge colos over ~30–60s** — right after `secret put`, endpoints flap
> 200/401 depending on which colo answers. That is not a routing bug; re-test ~25s apart until it
> converges.

### 5. Seed the owner row  — [OWNER, additive R1]  ⬜ NOT DONE (verified empty 2026-07-20)
The `users` table is still empty. Harmless today — role enforcement is unwired (see the last
section), so the single allow-listed Access email IS the owner. Do this when a second admin is
invited, or now if you want the row to exist.
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
