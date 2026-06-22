# @l-shopee/admin

Next.js + TypeScript admin UI and **offline-first POS**, deployed to **Cloudflare Workers** via the
**OpenNext** adapter. Not yet initialized — intentional stub so the lockfile stays clean until Phase 1.

## Initialize (Phase 1)

```bash
# from repo root — scaffolds Next.js + OpenNext + wrangler config
npm create cloudflare@latest -- apps/admin --framework=next
```

This configures `@opennextjs/cloudflare`, an `open-next.config.ts`, `nodejs_compat`, and the
`opennextjs-cloudflare build | preview | deploy` scripts. Then:

- Add `@l-shopee/core` (pricing/profit/tax/cost/stock) and `@l-shopee/db` (D1) as workspace deps.
  Never duplicate the money math — always call `@l-shopee/core`.
- Configure as a **PWA** with a local store (IndexedDB) for the offline POS, plus an outbox that
  POSTs to the `apps/api` `/sync` endpoint (idempotent on `client_uuid`). See
  [../../docs/CLOUDFLARE_ARCHITECTURE.md](../../docs/CLOUDFLARE_ARCHITECTURE.md) → "Offline-first POS flow".
- Call `apps/api` over a **Service Binding** rather than the public Internet.
- Gate the app behind **Cloudflare Access** (Zero Trust) for staff SSO/MFA.

## Planned screens

Products · variants · images · categories (type/brand/usage) · Thai T&C editor · inventory &
stock ledger · **offline POS sale screen** · pricing & fee profiles · sales table · finance
reports & export · Shopee connection (later) · users/roles · audit log.
