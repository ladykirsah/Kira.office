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

The admin is its **own** Workers Builds project (distinct from the api):

- **Root directory:** `apps/admin`
- **Deploy command:** `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`
- **Production branch:** `main`

`wrangler.jsonc` here targets the `kiraoffice-admin` Worker on the homeseeker account. Add a custom
domain (`app.homeseeker.me`) via a `routes` entry or the dashboard once the UI is ready. Gate the app
behind **Cloudflare Access** (Zero Trust) before launch.

## Planned screens

Add/edit product + image upload · barcode management · Thai T&C editor · stock ledger · pricing &
fee profiles · sales table · finance reports + CSV export · Shopee linkage. See
[../../docs/PRODUCTION_LAUNCH.md](../../docs/PRODUCTION_LAUNCH.md).
