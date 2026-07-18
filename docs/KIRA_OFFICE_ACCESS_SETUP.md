# Kira.office (admin) — go-live via Cloudflare Access

Goal: host the **admin back office** on a real domain, reachable only by the owner, logging in with an
**email one-time code**. This is independent of the AirPlus storefront launch — separate Worker,
separate domain.

> **Owner decisions (2026-07-18):**
> - Login method: **Email one-time PIN** (not Google).
> - **Super admin = `lady.kirsah@gmail.com`** only. No other email may enter.
> - Role in the app: **`owner`**.

## The security model (read this once)

- **There is no password.** The `users` table has no password column, by design. Cloudflare Access
  logs you in by emailing a 6-digit code to an allow-listed address. Nothing to store, nothing to leak.
- **"Invite an admin" = add their email to the Access policy** in the Zero Trust dashboard (+ seed a
  `users` row for their role). There is no invite UI to build.
- **Access must cover the API too, not just the admin UI.** The admin talks to `api.homeseeker.me`;
  if only the UI were gated, anyone could hit the open API directly.
- **⚠️ THE ONE GOTCHA — keep `/img/*` public.** The AirPlus storefront loads every product image from
  `https://api.homeseeker.me/img/*` with no login. If Access gates the whole API host, every product
  photo on the customer storefront 403s and the shop looks broken. The API code already treats
  `/img/*` as public (`apps/api/src/index.ts` — `isPublic = url.pathname.startsWith("/img/")`), but
  Cloudflare Access blocks at the *edge*, before the code runs — so the Access policy must **bypass**
  `/img/*` explicitly.

## Why the sequence matters (do NOT gate the API first)

Today the admin runs on your laptop (`localhost`) and calls `api.homeseeker.me`, which is open.
The moment Access gates the API, those localhost calls have no Access session and **break** — you'd
lock your own working setup out. So the admin must be **deployed to its own gated domain first**, and
you then use the admin *through that domain* (where the Access session exists and is forwarded to the
API by the admin's `/api/worker` proxy), not through localhost.

**Do the whole thing on STAGING first.** A wrong Access rule on the prod API takes the storefront's
images down. Verify the flow end-to-end on staging, then repeat on prod.

---

## Steps

### 1. Deploy the admin Worker to a domain  — [OWNER + CODE]
The admin (`kiraoffice-admin`) is on the **homeseeker** Cloudflare account and has never been deployed.
- [OWNER] Create a Workers-edit API token on the homeseeker account; add it as the repo secret
  `CF_ADMIN_API_TOKEN` (this flips on the `deploy-admin` CI job), OR run `npm run deploy -w @l-shopee/admin` locally.
- [CODE] Add a custom domain to `apps/admin/wrangler.jsonc`, e.g. `app.homeseeker.me`.

### 2. Create the Access application for the ADMIN  — [OWNER, dashboard]
Cloudflare dashboard → **Zero Trust → Access → Applications → Add an application → Self-hosted**.
- Application domain: your admin domain (e.g. `app.homeseeker.me`).
- **Login method: One-time PIN** (turn off other IdPs for this app if you want email-only).
- Policy → **Allow**, rule type **Emails**, value: `lady.kirsah@gmail.com`. Nothing else.
- Save. Copy the application's **AUD tag** and note your **team domain** (`<your-team>.cloudflareaccess.com`).

### 3. Create the Access application for the API, WITH the `/img/*` bypass  — [OWNER, dashboard]
Two applications on `api.homeseeker.me`, most-specific path first:
- **App A (bypass):** path `api.homeseeker.me/img/*` → policy **Bypass**, **Everyone**. (Keeps product images public.)
- **App B (protected):** path `api.homeseeker.me/*` → **One-time PIN**, **Allow → Emails → `lady.kirsah@gmail.com`**.
  Reuse the same AUD as the admin app if the dashboard lets you, or note App B's AUD.

### 4. Set the Worker secrets  — [OWNER runs; values from steps 2–3]
On the **API** Worker (never paste these into chat or a file):
```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler secret put ACCESS_TEAM_DOMAIN   # <your-team>.cloudflareaccess.com
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler secret put ACCESS_AUD           # the AUD tag
```
Once both are set, `requireAccess` verifies the Access JWT on every non-`/img/*` request; an
un-authed request gets 401/403. (Staging first: use the staging API Worker + a staging Access app.)

### 5. Seed the owner row  — [do at go-live; additive, R1]
So audit rows carry your email and future role-gating has data. No password — just email + role.
```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler d1 execute kira-office --remote --command \
  "INSERT INTO users (id, name, email, role, status, created_at) VALUES ('<uuidgen>', 'Lady Kirsah', 'lady.kirsah@gmail.com', 'owner', 'active', strftime('%s','now')*1000);"
```
Generate `<uuidgen>` fresh (macOS: `uuidgen | tr A-Z a-z`). Verify: `SELECT email, role FROM users;`

### 6. Verify  — [CODE + OWNER]
- Hit the admin domain in a fresh browser → Access prompts for the email code → enter it → admin loads.
- Confirm the admin can reach the API (products list, etc.) through the domain — this exercises the
  cross-account `/api/worker` proxy (the "1003" cautionary tale; verify on staging first).
- Confirm `https://api.homeseeker.me/img/<any-key>` still loads WITHOUT a login (storefront images).
- Confirm an un-authed `curl https://api.homeseeker.me/products` now 401s.

## Rollback
- Remove the two Access applications → the edge stops gating.
- `wrangler secret delete ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` → `requireAccess` fails open again.
- The admin keeps working on localhost throughout (localhost is never behind Access).

## Not needed yet — role enforcement
`resolveActor` + `requireRole` + `canPerform` are built and tested but **not wired into any route**.
With a single allow-listed email, everyone who gets in IS the owner, so role checks are redundant.
Wire them the day you invite a SECOND admin with a lesser role (`manager` / `stock_operator` /
`finance_viewer`) — that is a separate, TDD'd piece of work, not part of this single-owner setup.
