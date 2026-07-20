# AirPlus — customer storefront (`apps/storefront`)

The owner's own online car-parts store — the `airplus` sales channel. Next.js 15 App Router +
React 19 on Cloudflare Workers via OpenNext (same stack as `apps/admin`), but a **separate Worker
with zero staff/admin routes in it** — a routing bug here can never expose back-office surface.

**Kira IS the backend:** this Worker binds the SAME D1 database as `apps/api` directly (raw SQL,
same convention), the same KV (reads `shop:paymentMethods` for the PromptPay target), and
cross-binds the `StockLedger` Durable Object from the `kiraoffice` Worker via `script_name` (script
id has NO hyphen — pointing it at `kira-office` fails the deploy with 10061; see wrangler.jsonc).
It must deploy on the **same Cloudflare account as `apps/api`** (GoGoCash) — bindings don't cross
accounts.

## What it does

- Home v2 landing: shortcut bar, collections, a timed flash sale, best-sellers, shop-by-brand,
  categories, promo banners, and recently-viewed — plus a dedicated search landing at `/search`
  (recent-search chips, car-logo tiles, case-driven suggestions).
- Catalog browse + search (matches product name, part number, brand, and **car fitment** — "Vigo"
  finds everything that fits a Vigo), part-type chips, no dropdown cascades.
- Image-first product page with fitment list and per-product VAT-inclusive price display, a header
  Share action and collapsible section blocks.
- Client-side cart (localStorage) → **guest checkout**: phone + name only, flat address form,
  3 payment methods (PromptPay QR / bank transfer / COD) described plainly BEFORE commit.
- `POST /api/checkout`: server-side re-pricing (client prices never trusted), fail-closed stock
  check, idempotent on a client ref (retry ≠ duplicate order), real profit recorded per order,
  atomic D1 batch, then stock deduction through the shared `StockLedger` DO (idempotent per order,
  fail-open on infra errors — the unpaid order survives; conflicts are logged for the owner).
- `POST /api/payments/slip`: customer attaches a transfer slip — the QR is decoded **client-side**
  (jsQR) and only the payload is submitted. With `SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID` secrets set
  on THIS Worker it auto-verifies and marks the order paid (one-slip-one-payment enforced); unset,
  it holds the payload on the payment row for manual review.
- Order tracking by **phone + order number** (`/orders`, `GET /api/orders/lookup`) — guest lookup
  needs no account; the submit is gated until a ref and full phone are entered, and a deep-link
  entry hides the form and shows only that order. (Logged-in members also see their orders under
  `/account/orders`.) Wrong phone and unknown ref still return identical 404s.
- Phone-OTP member login (`/login`, login|register mode tabs; new members get a PDPA consent panel;
  6-box OTP with resend countdown). `POST /api/auth/otp/send` enforces a registration gate (login →
  already-registered only; register → new number only); `POST /api/auth/otp/verify` enforces the
  consent invariant. Backed by `storefront_sessions` + throttle, a Turnstile seam, and
  `OTP_DEV_ECHO` on staging.
- Account area: `/account` hub with a PDPA consent-receipt card, `/account/orders`,
  `/account/addresses`, and a `/account/coupons` wallet.
- **LINE help**: every "ช่วยหาอะไหล่ / ช่วยเหลือ / เพิ่มเพื่อน LINE" action (home shortcut, PDP
  sticky bar, account tile, home follow strip) opens the shop's LINE OA add-friend link directly
  (`LINE_OA_URL = https://lin.ee/tltIFtI` → `@811gvdun`, in `src/lib/links.ts`) — the LINE app on
  mobile, the add-friend web page on desktop.
- Coupons (mock, no backend yet): a `/coupons` catalog to collect and a `/account/coupons` wallet to
  copy codes; persisted in localStorage (`lib/coupons.ts`) until a real backend ships.
- Agent-discovery + legal routes: `/llms.txt`, `/sitemap.md`, `/skills.md`, `/rss.xml`,
  `/sitemap.xml`, plus draft `/privacy` and `/terms` pages.

## Local dev

```bash
npm run dev -w @l-shopee/storefront   # port 3002
```

`next.config.mjs` calls `initOpenNextCloudflareForDev` with `persist.path` pointed at the REPO
ROOT `.wrangler/state`, so local dev shares the same local D1 that
`npx wrangler d1 migrations apply kira-office --local` (run at the root) migrates. Seed dev
products before first use (see the session scratchpad seed, or insert via SQL).

Local limits (by design, verified):
- The cross-Worker DO binding is **unresolvable under `next dev`** — stock deduction logs
  `[checkout] stock deduction failed/skipped` and the checkout still succeeds. It works on a real
  deploy (apps/api must be deployed first so the DO class exists).
- Product images 404 locally (they live in the deployed Worker's R2) — every image spot renders a
  Thai placeholder frame instead.

## Deploy

```bash
npm run deploy -w @l-shopee/storefront            # production (GoGoCash account)
npx wrangler deploy --env staging                  # staging (kira-office-staging DO)
```

Secrets (per Worker, via `wrangler secret put`): `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID` (optional —
unset keeps slip verification in manual-review mode). Phone-OTP member login reads an SMS provider —
`THAIBULKSMS_API_KEY` (+ optional `THAIBULKSMS_API_SECRET`, `THAIBULKSMS_SENDER`), or the Twilio
fallback `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` — plus optional Turnstile keys
(`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) to gate the OTP-send endpoint.

The **staging** env sets `OTP_DEV_ECHO=1` in `wrangler.jsonc` (never in the default/production
config): OTP delivery is skipped, the code is the fixed `123456` and echoed to the UI, so the login
flow can be walked on a phone without an SMS provider. Remove it once `THAIBULKSMS_*` secrets are set.

**Staging preview** (durable, phone-viewable): <https://airplus-storefront-staging.bettergogocash.workers.dev>
(Worker `airplus-storefront-staging`, D1 `kira-office-staging`). To test member login on a phone,
open `/login`, enter any number (e.g. `0123456789`), and use the on-screen code **`123456`**.

## Pending owner inputs

- Den Air Service business bank-account details (transfer method shows a placeholder until then).
- PromptPay ID in Shop settings (admin) — checkout reads the default method from KV.
- SlipOK account + secrets for auto-confirmation.
- SMS provider account (ThaiBulkSMS, or Twilio as fallback) + Cloudflare Turnstile keys — required
  before phone-OTP member login can go live in production (staging fakes it with `OTP_DEV_ECHO=1`).
- Storefront domain (runs on `*.workers.dev` until then).
