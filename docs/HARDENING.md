# Production hardening

Status of the production-hardening checklist (task #16). Code-level items are done; the rest are
Cloudflare dashboard/config on the **GoGoCash** account.

## Done (in code)

- **Security headers** — every API response sends `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (see `SECURITY_HEADERS` in the Worker).
- **Observability** — `observability.enabled` is on in `wrangler.jsonc`; logs/metrics in the dashboard
  (Workers & Pages → kira-office → Observability).
- **Idempotency / integrity** — D1 unique indexes on `onsite_sales.client_uuid` and
  `(sales_orders.channel, external_order_id)`. **Stock writes are NOT serialized** — the StockLedger
  DO is a stateless RPC hop over D1, so its oversell check races (see CLOUDFLARE_ARCHITECTURE.md).

## [OWNER] Cloudflare config (no code)

- **Rate limiting / WAF** — on the homeseeker.me zone (now under GoGoCash): the one-click
  **Bot Fight Mode** + **Leaked credentials** are already visible in your Security tab; also add a
  **Rate limiting rule** for `api.homeseeker.me` (e.g. 100 req/min per IP) under Security → WAF →
  Rate limiting rules.
- **Auth — Cloudflare Access (task #10).** The Worker already enforces an Access JWT *when configured*
  (it's a no-op until then, so nothing is locked out today). To turn it on:
  1. Zero Trust → Access → Applications → **Add a self-hosted app** for `api.homeseeker.me` (and later
     `app.homeseeker.me`), add a policy allowing your email. This is the **primary edge gate**.
  2. Copy the application **AUD** tag and your team domain (`<team>.cloudflareaccess.com`).
  3. Set them on the `kira-office` Worker as vars/secrets: `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN`
     (Workers & Pages → kira-office → Settings → Variables, or `wrangler secret put`).
  4. Verify: a request without the Access cookie/JWT now gets `401`; through the browser (after the
     Access login) it works. Mutations are audit-logged with the Access user email.

## Backups & recovery

- **D1 Time Travel** — automatic point-in-time restore (30-day window on the Workers Paid plan).
  Restore with `wrangler d1 time-travel restore kira-office --timestamp=<ISO>`.
- **Scheduled export** — a daily logical backup is wired via the Cron trigger (task #14): the
  scheduled handler exports key tables to the R2 `kiraoffice-images` bucket (or a dedicated backups
  bucket). Verify the first export lands, then set a retention lifecycle on the bucket.
- **Restore drill** — before go-live, do one practice restore from Time Travel into a temp DB and
  confirm row counts.
