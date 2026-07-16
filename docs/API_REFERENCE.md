# API Reference — `apps/api` Worker

The single Cloudflare Worker behind `https://api.homeseeker.me`. Implemented in
[`apps/api/src/index.ts`](../apps/api/src/index.ts) as a `fetch` handler that matches
`url.pathname` + `request.method` (no router framework). The typed browser client is
[`apps/admin/src/lib/api.ts`](../apps/admin/src/lib/api.ts) — each endpoint below names its client
function.

> **Update both sides together.** If you change a request/response shape in the Worker, update the
> matching type + fetcher in `lib/api.ts`. Drift here is silent until runtime.

## Conventions

- **Money:** all `*Satang` fields are integer satang (1 THB = 100 satang). Rates are basis points
  (`*Bp`, 7% → `700`). Timestamps are integer epoch ms (UTC).
- **Auth:** optional Cloudflare Access JWT via the `Cf-Access-Jwt-Assertion` header. Enforced **only**
  when the Worker has `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` set; otherwise all routes are open. `GET
  /img/*` is always public. On failure: `401 {"error":"unauthorized"}`.
- **CORS:** `access-control-allow-origin: *` (no cookies; the Access JWT rides a header). Security
  headers (`x-content-type-options`, `x-frame-options: DENY`, `referrer-policy: no-referrer`) on
  every response. `OPTIONS` returns the preflight.
- **Errors:** non-2xx responses are `{ "error": "<message>" }` with an appropriate status. Clients
  throw `Error(error ?? "… (HTTP <status>)")`.
- **Image upload bodies are raw** (the file is the request body; `content-type` is the file's MIME),
  **not** multipart form-data.

## Health & images

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `GET` | `/img/:key` | Serves an R2 object (`IMAGES` bucket) by key. **Public (the only auth-exempt route).** Restricted to the image namespaces — the key must start with `products/` or `shop/`; anything else (e.g. the daily `backups/*.json` DB dump in the same bucket) returns `404`. `:key` is URL-encoded. |

## Shop info & services

Shop settings live in **KV** (no D1 table), one key each as `shop:<field>`; uploaded images go to R2 and are served via `GET /img/shop/...`.

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/shop-info` | `fetchShopInfo()` | Bilingual `ShopInfo`: `name`/`nameEn`, `address`/`addressEn`, `quoteNote`/`quoteNoteEn`, `qrHeadline`/`qrHeadlineEn`, `qrSubtitle`/`qrSubtitleEn`, plus `logoKey`/`qrKey` (R2 keys, or `null`). |
| `PUT` | `/shop-info` | `saveShopInfo()` | Writes the 10 text fields (replaces all — the admin always sends the full set). |
| `POST` | `/shop-info/logo` | `uploadShopImage("logo", file)` | Raw image body (jpeg/png/webp ≤5 MB) → stores R2 `shop/logo-<uuid>.<ext>`, records `shop:logoKey`; returns `{key, url}`. |
| `POST` | `/shop-info/qr` | `uploadShopImage("qr", file)` | As logo, for the contact-QR (`shop:qrKey`) — printed on the quotation. |
| `GET` | `/services` | `fetchServices()` | Managed labour/service catalogue (the POS "Service" add method). |

## Products

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/products` | `fetchProducts()` | List rows: `{id, productCode, name, status, imageKey, shopeeListed, offlinePriceSatang, onlinePriceSatang, onHand}`. |
| `POST` | `/products` | `createProduct()` | Body `{productCode, name, description?, barcode?}` → `{productId, variantId, created}`. |
| `GET` | `/products/:id` | `getProductDetail()` | Full `ProductDetail` (product fields + `variantId`, `barcode`, `onHand`, `fitments[]`, `pricing`, `images[]`). Shape in `lib/api.ts`. |
| `PATCH` | `/products/:id` | `updateProduct()` | Partial product fields incl. `brandName`/`usageName`/`typeName` (resolved to ids / created on the fly) and `fitments[]`. Stamps `updated_at`. |
| `DELETE` | `/products/:id` | `archiveProduct()` | Soft archive (status change), not a hard delete. |
| `POST` | `/products/:id/barcode` | `addBarcode()` | Body `{barcodeValue?}`; generates an internal barcode when omitted → `{barcodeValue, generated}`. |
| `GET` | `/products/by-barcode/:code` | `lookupBarcode()` | `404` when not found (client returns `null`). |

### Product pricing

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `PUT` | `/products/:id/pricing` | `setProductPricing()` | Body `{itemCostSatang, targetPriceSatang, onlinePriceSatang, b2bPriceSatang, onlineCommissionBp, taxOnCost}`. Upserts the variant's `pricing_profiles` row. |
| `POST` | `/pricing/preview` | _(server-side preview)_ | Pricing/profit preview computed via `@l-shopee/core`. Confirm the exact body against the handler before using. |

### Product images (gallery)

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `POST` | `/products/:id/image` | `uploadProductImage()` | Raw body. Sets the product **cover** (`products.image_key`) → `{key, url}`. |
| `POST` | `/products/:id/images` | `uploadGalleryImage()` | Raw body. Adds a gallery image (`product_images`) → `{id, imageKey, isCover}`. First image is the cover. Max 10 enforced in the UI. |
| `DELETE` | `/products/:id/images/:imageId` | `deleteGalleryImage()` | Removes one gallery image. |

## Part attributes (managed dropdown lists)

Backs the product editor's brand / car-system / part-name dropdowns. `kind ∈ {brand, type, usage,
car_brand, car_model}`.

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/attributes` | `fetchAttributes()` | `{brands, types, usages, carBrands, carModels}` each `{id, name}[]`. |
| `POST` | `/attributes/:kind` | `addAttribute()` | Body `{name}` → `{id, name}` (find-or-create, case-insensitive). |
| `DELETE` | `/attributes/:kind/:id` | `deleteAttribute()` | |

## Car fitment (brand → model/era → service notes)

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/car-fitment` | `fetchCarFitment()` | `{brands: CarBrandTree[]}`; each brand has `models: CarModelNode[]` carrying era + `oringUsage` + service notes. |
| `POST` | `/car-fitment/brands` | `addCarBrand()` | Body `{name}`. |
| `DELETE` | `/car-fitment/brands/:id` | `deleteCarBrand()` | |
| `POST` | `/car-fitment/brands/:brandId/models` | `addCarModel()` | Body `{name, yearFrom, yearTo}`. A model is a **generation**: same name may repeat once per era. |
| `PATCH` | `/car-fitment/models/:id` | `updateCarModel()` | Body = `CarModelInfo` (`generationCode, yearFrom, yearTo, refrigerant, oringUsage[], coolantLiters, notes`). `oringUsage` is `{size, qty}[]`, persisted as JSON in `car_models.oring_usage`. |
| `DELETE` | `/car-fitment/models/:id` | `deleteCarModel()` | |

## Stock & barcodes

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/stock` | `fetchStock()` | Per-variant on-hand (derived from `stock_ledger_entries`). |
| `POST` | `/stock/adjust` | `adjustStock()` | Body `{productVariantId, quantityDelta, movementType, reason?}` → `{applied, quantityAfter, reason?}`. Goes through the `StockLedger` DO. Rejects a delta that would drive stock negative — but the check **races under concurrency** (see the Durable Object section). |
| `GET` | `/barcodes` | `fetchBarcodes()` | All variants + their primary barcode. |

## Sales & finance

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/sales` | `fetchSales()` | On-site sales with `grossProfitSatang`. |
| `POST` | `/sales/:id/refund` | `refundSale()` | Restocks lines via the ledger → `{applied, reason?, restockedLines}`. |
| `GET` | `/sales/export.csv` | _(link)_ | CSV export for the accountant. |
| `GET` | `/finance/summary` | `fetchFinanceSummary()` | `{salesCount, revenueSatang, vatSatang, grossProfitSatang, refundCount, refundedSatang}`. |
| `GET` | `/orders` | `fetchOrders()` | Imported Shopee orders plus AirPlus storefront orders (`OrderRow[]`), newest first. |
| `PATCH` | `/orders/:id` | `updateAirPlusOrder()` | Fulfilment editor for an **AirPlus-channel** order (`404` for Shopee/absent rows). Body `OrderPatch {orderStatus?, paymentStatus?, carrier?, trackingNo?}` — a key present with an empty string clears the column to `NULL`; returns `{order: OrderRow}`. The **first** time a tracking number is set, `ship_time_ms` is stamped (later corrections keep the original). Two-axis lifecycle rides existing free-text columns (no schema change): `order_status` (fulfilment) `new → preparing (เตรียมจัดส่ง) → shipping → done` + cancel/refund branches, and `payment_status` (money) `awaiting → paid` + COD. |

## Offline POS sync & imports

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `POST` | `/sync` | _(POS outbox via `/api/worker`)_ | Body `{sales: SyncSale[]}` → `SyncResult {applied, duplicates, conflicts[], validationErrors[]}`. **Idempotent on `clientUuid`**; runs through the `StockLedger` DO; **fail-closed** on oversell (entire sale rejected) or invalid lines (`validationErrors`). |
| `POST` | `/import/products` | `importProductsCsv()` | Body `{csv, mapping}` → `{received, valid, invalid, errors[]}`. |
| `POST` | `/import/shopee-orders` | `importShopeeOrdersCsv()` | Body `{csv, mapping}` → `{received, imported, duplicates, invalid, errors[]}`. CSV bridge until live Shopee API. |

## Terms (Thai T&C)

| Method | Path | Client fn | Notes |
| --- | --- | --- | --- |
| `GET` | `/terms/template` | `fetchTermsTemplate()` | `{template}`. |
| `PUT` | `/terms/template` | `saveTermsTemplate()` | Body `{template}`. Per-product generate+approve flow is not built yet. |

## Durable Object

`StockLedger` (`class StockLedger extends DurableObject<Env>`, bound `STOCK_LEDGER`) is a
**stateless RPC facade** over D1 — three methods that delegate to `applySyncToDb` /
`applyAdjustmentToDb` / `refundSaleToDb`. `/sync`, `/stock/adjust`, and refunds route their ledger
writes through it. It is invoked internally by the Worker, not exposed as an HTTP route.

> ⚠️ **It does not serialize anything.** It holds no DO storage and uses no `blockConcurrencyWhile`,
> so concurrent calls interleave across their D1 awaits and the oversell check races. D1's unique
> index on `onsite_sales.client_uuid` is the *real* double-count backstop. See
> [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md) before relying on serialization.
