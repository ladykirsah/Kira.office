# Shopee Integration Plan

## Official Resource

Main platform: https://open.shopee.com

Official pages identified for this project:

- Developer guide: https://open.shopee.com/developer-guide/4
- Developer account registration: https://open.shopee.com/developer-guide/12
- App management: https://open.shopee.com/developer-guide/14
- API calls: https://open.shopee.com/developer-guide/16
- Authorization process: https://open.shopee.com/developer-guide/20
- Push mechanism: https://open.shopee.com/developer-guide/18
- Order management: https://open.shopee.com/developer-guide/229
- Sandbox testing V2: https://open.shopee.com/developer-guide/644

Relevant API document pages found from the official Open Platform:

- `v2.public.get_access_token`: https://open.shopee.com/documents/v2/v2.public.get_access_token?module=104&type=1
- `v2.public.refresh_access_token`: https://open.shopee.com/documents/v2/v2.public.refresh_access_token?module=104&type=1
- `v2.shop.get_shop_info`: https://open.shopee.com/documents/v2/v2.shop.get_shop_info?module=92&type=1
- `v2.product.get_item_list`: https://open.shopee.com/documents/v2/v2.product.get_item_list?module=89&type=1
- `v2.product.get_item_base_info`: https://open.shopee.com/documents/v2/v2.product.get_item_base_info?module=89&type=1
- `v2.product.get_model_list`: https://open.shopee.com/documents/v2/v2.product.get_model_list?module=89&type=1
- `v2.product.add_item`: https://open.shopee.com/documents/v2/v2.product.add_item?module=89&type=1
- `v2.product.update_item`: https://open.shopee.com/documents/v2/v2.product.update_item?module=89&type=1
- `v2.product.update_stock`: https://open.shopee.com/documents/v2/v2.product.update_stock?module=89&type=1
- `v2.product.add_model`: https://open.shopee.com/documents/v2/v2.product.add_model?module=89&type=1
- `v2.product.init_tier_variation`: https://open.shopee.com/documents/v2/v2.product.init_tier_variation?module=89&type=1
- `v2.product.update_tier_variation`: https://open.shopee.com/documents/v2/v2.product.update_tier_variation?module=89&type=1
- `v2.media_space.upload_image`: https://open.shopee.com/documents/v2/v2.media_space.upload_image?module=91&type=1
- `v2.media.upload_image`: https://open.shopee.com/documents/v2/v2.media.upload_image?module=130&type=1
- `v2.order.get_order_list`: https://open.shopee.com/documents/v2/v2.order.get_order_list?module=94&type=1
- `v2.order.get_order_detail`: https://open.shopee.com/documents/v2/v2.order.get_order_detail?module=94&type=1
- `v2.push.get_app_push_config`: https://open.shopee.com/documents/v2/v2.push.get_app_push_config?module=105&type=1
- `v2.push.set_app_push_config`: https://open.shopee.com/documents/v2/v2.push.set_app_push_config?module=105&type=1

## Integration Goals

- Connect one or more Shopee seller shops.
- Import Shopee products and map them to local products/variants.
- Upload or update product data when admin approves.
- Upload product images when supported for the selected business scenario.
- Sync local stock updates to Shopee item/model stock.
- Import Shopee online orders into the sales and finance records.
- Support push notifications or scheduled polling depending on app approval and shop configuration.

## Authorization Plan

1. Register or confirm Shopee Open Platform developer account.
2. Create an app in the Shopee Open Platform console.
3. Configure redirect URL for local/staging/production environments.
4. Admin starts Shopee authorization flow from the back office.
5. System exchanges authorization code for access token and refresh token.
6. System stores token references securely, not in source code.
7. Background job refreshes tokens before expiry.

## Product Sync Strategy

Local product records should store the seller's internal business data. Shopee listing records should store Shopee-specific ids and sync status.

Recommended flow:

1. Import Shopee item list.
2. Import item base info and model list.
3. Match by SKU/barcode where possible.
4. Admin reviews unmatched listings.
5. Admin approves mapping.
6. Future edits queue sync jobs instead of calling Shopee immediately from the UI request.

## Stock Sync Strategy

Local stock should be updated through the stock ledger first. If the variant is linked to a Shopee item/model, a stock sync job should call Shopee stock update.

Important rule: on-site sales and Shopee online sales both affect available stock. The system needs conflict handling when Shopee orders arrive after local stock changed.

## Order Sync Strategy

Recommended MVP:

1. Poll Shopee order list by date window.
2. Fetch order details.
3. Upsert into `sales_orders` using unique channel order id.
4. Match order lines to local variants by Shopee item/model mapping.
5. Calculate estimated profit using stored pricing profile at sale time.
6. Add stock ledger entries only when the order reaches a confirmed stock-affecting status.

## Push Or Polling

Shopee Open Platform exposes push configuration pages, but push availability and event types should be verified for the approved app and region. The MVP can start with polling and add push events later.

## Implementation Risks

- Shopee app approval may limit available APIs.
- Regional Shopee rules can affect categories, listing fields, taxes, fees, and stock behavior.
- Some sellers may have Fulfilled by Shopee or global product behavior that changes stock update rules.
- API docs are dynamic and should be rechecked before implementation.
- Token refresh behavior must be tested carefully.

## Information Needed From Owner

- Shopee seller region/country.
- Whether the seller account is already active.
- Whether a Shopee Open Platform app already exists.
- App type, partner id, and redirect URL plan.
- Whether this will manage one shop or multiple shops.
- Whether the shop uses Fulfilled by Shopee, SIP, global products, or only normal local listings.
