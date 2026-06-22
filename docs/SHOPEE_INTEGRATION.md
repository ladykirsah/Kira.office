# Shopee Integration Plan

## TL;DR — Important Constraint

**Shopee Thailand grants direct Open API access mainly to _managed sellers_** (those with an
assigned **Key Account Manager / KAM**). Non-managed sellers are typically directed to a
third-party partner platform. New developers are approved for **v2 APIs only**.

The owner does **not** yet have a Shopee Open Platform app. Therefore:

- **Phase now:** build the back office fully **without** the API. Bridge Shopee data with **CSV
  import/export** from Seller Centre (orders in, stock out).
- **Gated later phase:** wire the **live v2 API** once the owner confirms eligibility.
- All Shopee code lives behind an **integration boundary** so switching CSV → API changes core
  logic almost not at all.
- On Cloudflare: the API is a **Worker**, async Shopee work runs on **Queues** (with a dead-letter
  queue), scheduled polling and token refresh use **Cron Triggers**, and the partner key + tokens
  live in **Secrets Store** (never in source). See [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md).

_Verified June 2026 via Shopee TH seller-education portal and the TH Open API Developer Guide._

## Owner Action To Unlock The API

1. In **Shopee Seller Centre / Seller Support**, ask whether the shop qualifies for **Open API
   access** (managed-seller / KAM), or whether a partner platform is required.
2. If eligible: register a **Shopee Open Platform** developer account at https://open.shopee.com,
   create a **v2 app**, and obtain `partner_id` + `partner_key` (test app first).
3. Provide app type, `partner_id`, and the redirect URL plan. Then the API phase can begin.

## Official Resources

- Platform: https://open.shopee.com
- Developer guide: https://open.shopee.com/developer-guide/4 · Registration: `/12` · App mgmt: `/14`
  · API calls: `/16` · Authorization: `/20` · Push: `/18` · Orders: `/229` · Sandbox V2: `/644`
- TH seller guide: https://seller.shopee.co.th/edu/article/15124

### API areas (v2) to use later
- Auth: `public.get_access_token`, `public.refresh_access_token`
- Shop: `shop.get_shop_info`
- Product: `product.get_item_list`, `get_item_base_info`, `get_model_list`, `add_item`,
  `update_item`, `update_stock`, `add_model`, `init_tier_variation`, `update_tier_variation`
- Media: `media_space.upload_image`
- Orders: `order.get_order_list`, `order.get_order_detail`
- Push: `push.get_app_push_config`, `push.set_app_push_config`

## CSV Bridge (works now, no API)

- **Orders in:** export orders from Seller Centre → import via `docs/DATA_IMPORT.md` mapping →
  upsert into `sales_orders` on `channel + external_order_id` (idempotent).
- **Stock out:** export local available stock to a Seller Centre-compatible CSV for manual upload.
- Match order lines to local variants by **SKU/barcode**; queue unmatched for admin review.
- Estimate profit from the pricing profile at sale time (online → include Shopee fees).

## Integration Goals (API phase)

- Connect one or more Shopee shops; import products and map to local products/variants.
- Upload/update product data and images when admin approves.
- Sync local stock to Shopee item/model stock.
- Import Shopee orders into sales/finance.
- Push or scheduled polling depending on app approval and shop config (MVP = polling).

## Authorization Plan (API phase)

1. Confirm developer account + create v2 app. 2. Configure redirect URLs per environment.
3. Admin starts authorization from the back office. 4. Exchange code for access + refresh tokens.
5. Store token **references** securely in Secrets Store / encrypted in D1 (never in source).
6. A **Cron Trigger** refreshes tokens before expiry.

## Sync Strategies (API phase)

- **Product:** import item list → base info/models → match by SKU/barcode → admin approves mapping
  → future edits **queue sync jobs** (no direct Shopee calls from a UI request).
- **Stock:** ledger-first; if a variant is linked, queue a Shopee stock-update job. On-site and
  online sales both reduce available stock — handle conflicts on sync (see ARCHITECTURE).
- **Orders:** poll by date window → fetch details → upsert on unique channel order id → match lines
  → estimate profit → ledger entry only at a confirmed stock-affecting status (Ready to ship/Paid).

## Risks

- App approval may limit available APIs; **TH access may require managed-seller status**.
- Regional rules affect categories, listing fields, taxes, fees, stock behavior.
- FBS / SIP / global products change stock-update rules — confirm the shop's setup.
- API docs are dynamic; re-verify before implementation. Token refresh must be tested carefully.

## Information Still Needed From Owner (for API phase)

Whether the shop qualifies for Open API (managed seller?); whether an app already exists; app type,
`partner_id`, redirect URL plan; one shop or multiple; whether the shop uses FBS, SIP, global
products, or only normal local listings.
