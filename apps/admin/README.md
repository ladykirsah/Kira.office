# @l-shopee/admin

Next.js (App Router) admin UI + POS, deployed to **Cloudflare Workers** via the **OpenNext** adapter.
Calls the api Worker at `https://api.homeseeker.me` and shares money/stock logic via `@l-shopee/core`.

## Status (scaffolded, builds)

- `src/app/page.tsx` — dashboard
- `src/app/products/page.tsx` — products list (live `GET /products`)
- `src/app/pos/page.tsx` — POS skeleton (add lines → `POST /sync`)
- `src/lib/api.ts` — typed API client · `src/lib/format.ts` — satang→THB display (tested)

`npm run build -w @l-shopee/admin` compiles all routes. Visual QA + the full offline-first POS
(barcode→variant lookup, IndexedDB outbox, conflict UI) are the next iteration.

## Develop

```bash
npm run dev -w @l-shopee/admin        # Next dev server
npm run preview -w @l-shopee/admin    # OpenNext build + local Workers runtime
```

Set `NEXT_PUBLIC_API_BASE` to point at a different API (defaults to `https://api.homeseeker.me`).

## Deploy (separate Worker: `kiraoffice-admin`)

**Deploys are MANUAL — nothing auto-deploys on push (verified 2026-07-20):**

```bash
npm run deploy -w @l-shopee/admin   # opennextjs-cloudflare build && deploy
```

- There is **no Workers Builds project** for the admin (no `Workers Builds: kiraoffice-admin`
  check on commits; every deployment shows `Source: Upload`).
- The GitHub Actions `deploy-admin` job **exits green without deploying** because the
  `CF_ADMIN_API_TOKEN` secret is unset — never read its green check as a real deploy. Setting
  the secret would enable auto-deploy on `main`.

`wrangler.jsonc` here targets the `kiraoffice-admin` Worker on the **GoGoCash** account
(`187ab61ed9dbc6e616cb23e6b95aa8f1` — same account as the api + storefront; the old homeseeker
account split caused the 1003 cross-account proxy failure). It is live at the custom domain
**`admin.homeseeker.me`**, gated by **Cloudflare Access** (email OTP) — see
[../../docs/KIRA_OFFICE_ACCESS_SETUP.md](../../docs/KIRA_OFFICE_ACCESS_SETUP.md) and
[../../docs/STATE_OF_THE_BUILD.md](../../docs/STATE_OF_THE_BUILD.md) §6 for the full deploy picture.

## Planned screens

Add/edit product + image upload · barcode management · Thai T&C editor · stock ledger · pricing &
fee profiles · sales table · finance reports + CSV export · Shopee linkage. See
[../../docs/PRODUCTION_LAUNCH.md](../../docs/PRODUCTION_LAUNCH.md).
