# Next Phase Prep (gated / out of scope today)

This document records **what is prepared in code** for later phases that are intentionally **not
built yet**. Apply migration `0017` before relying on the new tables locally or in prod.

See also [ROADMAP.md](ROADMAP.md) and [STATE_OF_THE_BUILD.md](STATE_OF_THE_BUILD.md).

## Migration `0017_gated_phase_prep.sql`

| Area | Tables / columns | Status after migration |
|------|------------------|------------------------|
| Variants | `product_variants.option_1_*`, `option_2_*` | Schema ready; editor still one implicit variant |
| Shopee | `shop_connections`, `shopee_listings`, `shopee_listing_models` | Empty tables; CSV bridge still the path |
| Thai T&C | `terms_patterns`, `product_terms`, `products.default_terms_pattern_id` | KV template endpoint unchanged; generate+approve UI not built |
| RBAC | Uses existing `users` table | `resolveActor` / `requireRole` stubs in API; not wired to routes yet |

Apply locally:

```bash
npx wrangler d1 migrations apply kira-office --local
```

Apply prod + staging (owner):

```bash
npx wrangler d1 migrations apply kira-office --remote
npx wrangler d1 migrations apply kira-office --remote --env staging
```

## Phase 5 — Shopee live API (gated)

**Unlock:** managed-seller Open Platform eligibility confirmed ([SHOPEE_INTEGRATION.md](SHOPEE_INTEGRATION.md)).

**Already in repo:**

- `packages/core/src/shopee.ts` — `computeShopeeStockUpdates()` (pure stock deltas)
- `apps/api/src/shopee.ts` — request signing helpers
- CSV import for orders/products (bridge until API)
- D1 mapping tables from migration `0017`

**Not built (owner provisions in Cloudflare dashboard):**

1. Uncomment `SHOPEE_QUEUE` producer/consumer block in root `wrangler.jsonc`
2. Set secrets: `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, shop tokens (names only — never commit)
3. Queue consumer handler in Worker `queue()` export
4. Admin UI: link product ↔ Shopee item/model using `shopee_listings` / `shopee_listing_models`
5. Wire `requireRole(actor, 'shopee.publish')` before any write to Shopee

## Phase 2b — Product variants UI

**Unlock:** confirm variant axes with owner ([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) #17).

**Prepared:** nullable option columns on `product_variants`; per-variant pricing/stock/barcode already exist.

**Next slice:** multi-row variant editor in admin; create/link rows instead of one implicit variant.

## Phase 2b — Thai T&C generate + approve

**Prepared:**

- `packages/core/src/productTerms.ts` — `buildTermsVars`, `generateProductTerms`, `canTransitionTermsStatus`
- D1 tables for patterns + versioned product bodies

**Next slice:**

1. CRUD API for `terms_patterns`
2. `POST /products/:id/terms/generate` → draft row in `product_terms`
3. Approve/publish endpoints gated by `canTransitionTermsStatus` + owner/manager role
4. Admin review screen (draft → approved → published)

## RBAC / staff users UI

**Prepared:**

- `packages/core/src/rbac.ts` — `canPerform(role, action)` aligned with REQUIREMENTS A5 owner-only list
- `apps/api/src/auth.ts` — `resolveActor`, `requireRole` (no-op when Access secrets unset)

**Next slice:**

1. Seed owner row in `users` when Access email is known
2. Staff invite UI (A2/A3)
3. Call `resolveActor` after `requireAccess` on mutating routes; return 403 from `requireRole`
4. Populate `audit_logs.user_id` from resolved actor

## Phase 6 — Private backup bucket

**Prepared:**

- `Env.BACKUPS` optional R2 binding; `runDailyBackup` uses `backupR2Bucket(env)` (`BACKUPS ?? IMAGES`)
- Commented `BACKUPS` bucket entries in `wrangler.jsonc`

**Owner steps:**

1. Create R2 bucket `kiraoffice-backups` (and `-staging`) with **no public access**
2. Uncomment `BACKUPS` binding in `wrangler.jsonc` for prod + staging envs
3. Redeploy API — cron continues writing `backups/YYYY-MM-DD.json` to the private bucket
4. Optional: lifecycle rule to expire objects after N days

## Verification

After pulling this prep work, the gate should stay green:

```bash
npm run format && npm run lint && npm run typecheck && npm test
```

New tests cover RBAC, product terms generation, backup bucket selection, and actor resolution.
