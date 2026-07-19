import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, KVNamespace, DurableObjectNamespace } from "@cloudflare/workers-types";

/**
 * Server-side data access for the storefront: raw SQL over the SAME D1 database as apps/api
 * (matching that Worker's raw-SQL convention — no query builder). Server components and route
 * handlers only; never imported from client components.
 */
export interface StorefrontEnv {
  DB: D1Database;
  KV: KVNamespace;
  /** Cross-Worker binding to apps/api's StockLedger DO. Unresolvable in local `next dev`. */
  STOCK_LEDGER?: DurableObjectNamespace;
  /** SlipOK slip-verification secrets (this worker's own copies; unset = manual-review mode). */
  SLIPOK_API_KEY?: string;
  SLIPOK_BRANCH_ID?: string;
  /** "1" = no SMS provider; OTP codes are logged + echoed for dev. NEVER in production. */
  OTP_DEV_ECHO?: string;
  /** Turnstile server secret (unset = verification passes open; throttles still apply). */
  TURNSTILE_SECRET_KEY?: string;
  /** Twilio SMS (fallback provider — see lib/sms.ts). */
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
  /** ThaiBulkSMS (owner's chosen production provider — see lib/sms.ts). */
  THAIBULKSMS_API_KEY?: string;
  /** Optional — some accounts use API key/secret pair; if unset, key is sent as Bearer. */
  THAIBULKSMS_API_SECRET?: string;
  /** Sender name shown on the SMS (default "AirPlus"). Must be pre-approved in the account. */
  THAIBULKSMS_SENDER?: string;
  /** LINE Login channel ID (public — appears in the authorize URL). Unset = LINE login disabled. */
  LINE_CHANNEL_ID?: string;
  /** LINE Login channel secret (server-only; set via `wrangler secret put`). */
  LINE_CHANNEL_SECRET?: string;
}

export async function getEnv(): Promise<StorefrontEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as StorefrontEnv;
}

export async function getDb(): Promise<D1Database> {
  return (await getEnv()).DB;
}

/* ---- catalog ---- */

import type { CampaignPriceInfo } from "@l-shopee/core";

export interface CatalogItem {
  productId: string;
  variantId: string;
  name: string;
  productRef: string;
  brandName: string | null;
  typeName: string | null;
  /** Warranty / return window in DAYS for this product's category (product_types), or null if unset. */
  warrantyDays: number | null;
  imageKey: string | null;
  /** BASE online price. Pass with `campaign` through core resolveEffectivePrice for display. */
  priceSatang: number;
  onHand: number;
  /** first fitment as a short display string, e.g. "Toyota Vigo" (null = none recorded) */
  fitmentShort: string | null;
  /** live flash-sale candidate for this variant (cheapest active-window one), or null */
  campaign: CampaignPriceInfo | null;
}

/** Raw row shape before the campaign columns are folded into a nested object. */
interface CatalogRow extends Omit<CatalogItem, "campaign"> {
  cpPriceSatang: number | null;
  cpStartsAt: number | null;
  cpEndsAt: number | null;
  cpStatus: string | null;
  cpStockCap: number | null;
  cpSoldCount: number | null;
}

/** Binds ONE `?` (now, epoch ms) for the campaign-candidate subselect — callers bind now first. */
const CATALOG_SELECT = `
  SELECT p.id AS productId, v.id AS variantId, p.name AS name, p.product_ref AS productRef,
         b.name AS brandName, t.name AS typeName, t.warranty_days AS warrantyDays, p.image_key AS imageKey,
         COALESCE(pp.online_price_satang, 0) AS priceSatang,
         COALESCE((SELECT SUM(quantity_delta) FROM stock_ledger_entries WHERE product_variant_id = v.id), 0) AS onHand,
         (SELECT TRIM(COALESCE(f.car_brand, '') || ' ' || COALESCE(f.car_model, ''))
            FROM product_fitments f WHERE f.product_id = p.id
            ORDER BY f.sort_order LIMIT 1) AS fitmentShort,
         cp.campaign_price_satang AS cpPriceSatang, cg.starts_at AS cpStartsAt,
         cg.ends_at AS cpEndsAt, cg.status AS cpStatus, cp.stock_cap AS cpStockCap,
         cp.sold_count AS cpSoldCount
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  LEFT JOIN pricing_profiles pp ON pp.id =
    (SELECT id FROM pricing_profiles WHERE product_variant_id = v.id ORDER BY active_from DESC LIMIT 1)
  LEFT JOIN campaign_prices cp ON cp.id =
    (SELECT cp2.id FROM campaign_prices cp2
       JOIN campaigns cg2 ON cg2.id = cp2.campaign_id
     WHERE cp2.product_variant_id = v.id AND cg2.status = 'active'
       AND cg2.starts_at <= ? AND cg2.ends_at > ?
     ORDER BY cp2.campaign_price_satang ASC LIMIT 1)
  LEFT JOIN campaigns cg ON cg.id = cp.campaign_id
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_types t ON t.id = p.type_id
  WHERE p.status = 'active'
    -- Never show out-of-stock: a variant is only listed while its ledger sum is positive. This is
    -- the single choke point for listCatalog / bestSellers / getProduct, so an out-of-stock product
    -- vanishes from grids AND its PDP (404), and reappears automatically the moment it is restocked.
    AND (SELECT COALESCE(SUM(quantity_delta), 0)
           FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0`;
const CATALOG_NOW_BINDS = 2;

function toCatalogItem(row: CatalogRow): CatalogItem {
  const { cpPriceSatang, cpStartsAt, cpEndsAt, cpStatus, cpStockCap, cpSoldCount, ...item } = row;
  const campaign: CampaignPriceInfo | null =
    cpPriceSatang !== null && cpStartsAt !== null && cpEndsAt !== null
      ? {
          campaignPriceSatang: cpPriceSatang,
          startsAt: cpStartsAt,
          endsAt: cpEndsAt,
          status: cpStatus === "active" ? "active" : "disabled",
          stockCap: cpStockCap,
          soldCount: cpSoldCount ?? 0,
        }
      : null;
  return { ...item, campaign };
}

/** Browse/search the catalog. q matches product name, part number, brand, and car fitment; the
 *  structured filters (type, brand, car brand/model/year) narrow it further for the filter sheet. */
export async function listCatalog(
  db: D1Database,
  opts: {
    q?: string;
    typeId?: string;
    brandId?: string;
    carBrand?: string;
    carModel?: string;
    year?: number;
    onSaleOnly?: boolean;
    limit?: number;
  } = {},
): Promise<CatalogItem[]> {
  const now = Date.now();
  const conds: string[] = [];
  const binds: unknown[] = [];
  if (opts.q) {
    const like = `%${opts.q.trim()}%`;
    conds.push(`(p.name LIKE ? OR p.product_ref LIKE ? OR b.name LIKE ?
      OR EXISTS (SELECT 1 FROM product_fitments f WHERE f.product_id = p.id
                 AND (COALESCE(f.car_brand,'') || ' ' || COALESCE(f.car_model,'')) LIKE ?))`);
    binds.push(like, like, like, like);
  }
  if (opts.typeId) {
    conds.push(`p.type_id = ?`);
    binds.push(opts.typeId);
  }
  if (opts.brandId) {
    conds.push(`p.brand_id = ?`);
    binds.push(opts.brandId);
  }
  // Car fitment: ONE fitment row must satisfy every chosen car criterion (brand/model/year-in-range),
  // so "Toyota + Vigo + 2015" can't be satisfied by three unrelated fitment rows.
  if (opts.carBrand || opts.carModel || opts.year != null) {
    const f: string[] = ["f.product_id = p.id"];
    if (opts.carBrand) {
      f.push(`f.car_brand = ?`);
      binds.push(opts.carBrand);
    }
    if (opts.carModel) {
      f.push(`f.car_model = ?`);
      binds.push(opts.carModel);
    }
    if (opts.year != null) {
      f.push(`(f.year_from IS NULL OR f.year_from <= ?) AND (f.year_to IS NULL OR f.year_to >= ?)`);
      binds.push(opts.year, opts.year);
    }
    conds.push(`EXISTS (SELECT 1 FROM product_fitments f WHERE ${f.join(" AND ")})`);
  }
  if (opts.onSaleOnly) conds.push(`cp.id IS NOT NULL`);
  const where = conds.length ? ` AND ${conds.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 48, 100);
  const rows = await db
    .prepare(
      `${CATALOG_SELECT}${where} ORDER BY COALESCE(p.updated_at, p.created_at) DESC LIMIT ${limit}`,
    )
    .bind(...Array(CATALOG_NOW_BINDS).fill(now), ...binds)
    .all<CatalogRow>();
  return (rows.results ?? []).map(toCatalogItem);
}

/** One row per indexable product for the sitemap: the fields the slug needs + a lastmod. Uncapped
 *  (unlike listCatalog's 100), one row per product (not per variant), and it applies the SAME
 *  active + in-stock gate as the PDP — so every URL in the sitemap actually resolves (never a 404). */
export interface SitemapProduct {
  productId: string;
  name: string;
  brandName: string | null;
  fitmentShort: string | null;
  updatedAt: number;
}

export async function sitemapProducts(db: D1Database): Promise<SitemapProduct[]> {
  const rows = await db
    .prepare(
      `SELECT p.id AS productId, p.name AS name, b.name AS brandName,
         (SELECT TRIM(COALESCE(f.car_brand, '') || ' ' || COALESCE(f.car_model, ''))
            FROM product_fitments f WHERE f.product_id = p.id
            ORDER BY f.sort_order LIMIT 1) AS fitmentShort,
         COALESCE(p.updated_at, p.created_at) AS updatedAt
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.status = 'active'
         AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id
                       AND (SELECT COALESCE(SUM(quantity_delta), 0)
                              FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0)
       ORDER BY COALESCE(p.updated_at, p.created_at) DESC
       LIMIT 45000`,
    )
    .all<SitemapProduct>();
  return rows.results ?? [];
}

/** A best-seller row carries its rank-driving metric: average units sold per month over the window
 *  (null for gap-fillers with no sales history). */
export type BestSeller = CatalogItem & { monthlySales: number | null };

/** Best sellers: top variants by units sold on AirPlus orders in the window; newest fill gaps. Each
 *  item carries `monthlySales` (units sold ÷ months in the window) for the ranked list's metric. */
export async function bestSellers(
  db: D1Database,
  opts: { days?: number; limit?: number } = {},
): Promise<BestSeller[]> {
  const now = Date.now();
  const limit = Math.min(opts.limit ?? 8, 24);
  const days = opts.days ?? 90;
  const since = now - days * 24 * 60 * 60 * 1000;
  const months = days / 30;
  const top = await db
    .prepare(
      `SELECT l.product_variant_id AS variantId, SUM(l.quantity) AS sold
       FROM sales_order_lines l JOIN sales_orders o ON o.id = l.sales_order_id
       WHERE o.channel = 'airplus' AND o.order_created_at >= ?
       GROUP BY l.product_variant_id ORDER BY sold DESC LIMIT ${limit}`,
    )
    .bind(since)
    .all<{ variantId: string; sold: number }>();
  const soldBy = new Map((top.results ?? []).map((r) => [r.variantId, r.sold]));
  const ranked = [...soldBy.keys()];
  // sold > 0 shows at least "1/เดือน" (never a misleading "0"); no history → null (hide the metric).
  const monthly = (variantId: string): number | null => {
    const sold = soldBy.get(variantId);
    return sold != null ? Math.max(1, Math.round(sold / months)) : null;
  };
  if (ranked.length === 0) {
    return (await listCatalog(db, { limit })).map((i) => ({ ...i, monthlySales: null }));
  }
  const rows = await db
    .prepare(`${CATALOG_SELECT} AND v.id IN (${ranked.map(() => "?").join(",")})`)
    .bind(...Array(CATALOG_NOW_BINDS).fill(now), ...ranked)
    .all<CatalogRow>();
  const byId = new Map((rows.results ?? []).map((r) => [r.variantId, toCatalogItem(r)]));
  const ordered: BestSeller[] = ranked
    .map((id) => byId.get(id))
    .filter((x): x is CatalogItem => Boolean(x))
    .map((item) => ({ ...item, monthlySales: monthly(item.variantId) }));
  if (ordered.length < limit) {
    const have = new Set(ordered.map((i) => i.variantId));
    const fill = (await listCatalog(db, { limit }))
      .filter((i) => !have.has(i.variantId))
      .map((i): BestSeller => ({ ...i, monthlySales: null }));
    ordered.push(...fill.slice(0, limit - ordered.length));
  }
  return ordered;
}

/** Car brands with active-product coverage ("shop by your car"). The home strip passes the small
 *  default; the /brands "see all" page passes a large limit to list every brand. */
export async function carBrandTiles(
  db: D1Database,
  limit = 8,
): Promise<{ brand: string; productCount: number }[]> {
  const rows = await db
    .prepare(
      `SELECT f.car_brand AS brand, COUNT(DISTINCT f.product_id) AS productCount
       FROM product_fitments f JOIN products p ON p.id = f.product_id AND p.status = 'active'
       WHERE f.car_brand IS NOT NULL AND TRIM(f.car_brand) != ''
         -- match the catalog: count only products with at least one in-stock variant
         AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
                     AND (SELECT COALESCE(SUM(quantity_delta), 0)
                            FROM stock_ledger_entries WHERE product_variant_id = pv.id) > 0)
       GROUP BY f.car_brand ORDER BY productCount DESC, brand LIMIT ${Math.min(limit, 64)}`,
    )
    .all<{ brand: string; productCount: number }>();
  return rows.results ?? [];
}

/** Car brands (Toyota, Honda, …) that have ≥1 active, in-stock product IN a given part category —
 *  powers the car-brand shortcut chips on a specific-category page. Scoped to the type so a brand
 *  that has no product in this category never appears (no dead-end chip → 0 results). */
export async function carBrandsForType(db: D1Database, typeId: string): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT f.car_brand AS brand
       FROM product_fitments f
       JOIN products p ON p.id = f.product_id AND p.status = 'active' AND p.type_id = ?
       WHERE f.car_brand IS NOT NULL AND TRIM(f.car_brand) != ''
         -- same in-stock rule as the catalog: only brands with a currently-buyable product
         AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
                     AND (SELECT COALESCE(SUM(quantity_delta), 0)
                            FROM stock_ledger_entries WHERE product_variant_id = pv.id) > 0)
       ORDER BY f.car_brand`,
    )
    .bind(typeId)
    .all<{ brand: string }>();
  return (rows.results ?? []).map((r) => r.brand);
}

/** Part categories that have ≥1 active, in-stock product fitting a given car brand — the mirror of
 *  carBrandsForType, powering the CATEGORY shortcut chips on a specific car-brand (By Brand) page.
 *  Scoped so a category with nothing for that brand never appears (no dead-end chip → 0 results). */
export async function productTypesForCarBrand(
  db: D1Database,
  carBrand: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .prepare(
      `SELECT t.id, t.name
       FROM product_types t
       JOIN products p ON p.type_id = t.id AND p.status = 'active'
       JOIN product_variants v ON v.product_id = p.id
       WHERE EXISTS (SELECT 1 FROM product_fitments f
                     WHERE f.product_id = p.id AND f.car_brand = ?)
         -- same in-stock rule as the catalog: only categories with a currently-buyable product
         AND (SELECT COALESCE(SUM(quantity_delta), 0)
                FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0
       GROUP BY t.id, t.name, t.sort_order
       ORDER BY t.sort_order, t.name`,
    )
    .bind(carBrand)
    .all<{ id: string; name: string }>();
  return rows.results ?? [];
}

/** Product brands (DENSO, Coolgear, …) with ≥1 active, in-stock product — the brand chips in the
 *  filter sheet. */
export async function listBrands(db: D1Database): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .prepare(
      `SELECT b.id, b.name
       FROM brands b
       JOIN products p ON p.brand_id = b.id AND p.status = 'active'
       JOIN product_variants v ON v.product_id = p.id
       WHERE (SELECT COALESCE(SUM(quantity_delta), 0)
                FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0
       GROUP BY b.id, b.name ORDER BY b.name`,
    )
    .all<{ id: string; name: string }>();
  return rows.results ?? [];
}

/** Car-fitment cascade options: each car brand with its models, limited to fitments on active,
 *  in-stock products. Year is a client-side list matched against year_from/year_to in listCatalog. */
export async function fitmentOptions(
  db: D1Database,
): Promise<{ brand: string; models: string[] }[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT f.car_brand AS brand, f.car_model AS model
       FROM product_fitments f
       JOIN products p ON p.id = f.product_id AND p.status = 'active'
       JOIN product_variants v ON v.product_id = p.id
       WHERE f.car_brand IS NOT NULL AND TRIM(f.car_brand) != ''
         AND (SELECT COALESCE(SUM(quantity_delta), 0)
                FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0
       ORDER BY f.car_brand, f.car_model`,
    )
    .all<{ brand: string; model: string | null }>();
  const byBrand = new Map<string, string[]>();
  for (const r of rows.results ?? []) {
    const models = byBrand.get(r.brand) ?? [];
    if (r.model && !models.includes(r.model)) models.push(r.model);
    byBrand.set(r.brand, models);
  }
  return [...byBrand.entries()].map(([brand, models]) => ({ brand, models }));
}

/** Part categories (product types) for the home category browser + catalog chips — only types that
 *  actually have an active, in-stock product, so empty categories never surface (matches the
 *  out-of-stock hiding rule). */
export async function listProductTypes(
  db: D1Database,
): Promise<{ id: string; name: string; productCount: number }[]> {
  const rows = await db
    .prepare(
      // Only types with an active, in-stock product surface; productCount = distinct such products
      // (same in-stock rule as the catalog + by-brand tiles, so the counts stay consistent).
      `SELECT t.id, t.name, COUNT(DISTINCT p.id) AS productCount
       FROM product_types t
       JOIN products p ON p.type_id = t.id AND p.status = 'active'
       JOIN product_variants v ON v.product_id = p.id
       WHERE (SELECT COALESCE(SUM(quantity_delta), 0)
                FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0
       GROUP BY t.id, t.name, t.sort_order
       ORDER BY t.sort_order, t.name`,
    )
    .all<{ id: string; name: string; productCount: number }>();
  return rows.results ?? [];
}

/* ---- product detail ---- */

export interface ProductDetail extends CatalogItem {
  description: string | null;
  images: { imageKey: string; sortOrder: number }[];
  fitments: {
    carBrand: string | null;
    carModel: string | null;
    yearFrom: number | null;
    yearTo: number | null;
  }[];
  /** true when the displayed price already includes 7% VAT (per-product tax profile). */
  priceIncludesVat: boolean;
  weightGrams: number;
}

export async function getProduct(db: D1Database, productId: string): Promise<ProductDetail | null> {
  const now = Date.now();
  const headRow = await db
    .prepare(`${CATALOG_SELECT} AND p.id = ? LIMIT 1`)
    .bind(...Array(CATALOG_NOW_BINDS).fill(now), productId)
    .first<CatalogRow>();
  const head = headRow ? toCatalogItem(headRow) : null;
  if (!head) return null;
  const [meta, images, fitments] = await Promise.all([
    db
      .prepare(
        `SELECT p.description AS description, p.weight_grams AS weightGrams,
                COALESCE(tp.price_includes_vat, 1) AS priceIncludesVat
         FROM products p LEFT JOIN tax_profiles tp ON tp.id = p.tax_profile_id WHERE p.id = ?`,
      )
      .bind(productId)
      .first<{ description: string | null; weightGrams: number; priceIncludesVat: number }>(),
    db
      .prepare(
        `SELECT image_key AS imageKey, sort_order AS sortOrder FROM product_images
         WHERE product_id = ? ORDER BY sort_order`,
      )
      .bind(productId)
      .all<{ imageKey: string; sortOrder: number }>(),
    db
      .prepare(
        `SELECT car_brand AS carBrand, car_model AS carModel, year_from AS yearFrom, year_to AS yearTo
         FROM product_fitments WHERE product_id = ? ORDER BY sort_order`,
      )
      .bind(productId)
      .all<{
        carBrand: string | null;
        carModel: string | null;
        yearFrom: number | null;
        yearTo: number | null;
      }>(),
  ]);
  return {
    ...head,
    description: meta?.description ?? null,
    weightGrams: meta?.weightGrams ?? 0,
    priceIncludesVat: Boolean(meta?.priceIncludesVat ?? true),
    images: images.results ?? [],
    fitments: fitments.results ?? [],
  };
}

/* ---- banners ---- */

export interface BannerRow {
  id: string;
  slot: "hero" | "promo";
  imageKey: string | null;
  linkUrl: string | null;
  sortOrder: number;
}

/** Active banners for a slot, honoring the optional schedule window. */
export async function activeBanners(db: D1Database, slot: "hero" | "promo"): Promise<BannerRow[]> {
  const now = Date.now();
  const rows = await db
    .prepare(
      `SELECT id, slot, image_key AS imageKey, link_url AS linkUrl, sort_order AS sortOrder
       FROM banners WHERE slot = ? AND status = 'active' AND image_key IS NOT NULL
         AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)
       ORDER BY sort_order, created_at DESC LIMIT 10`,
    )
    .bind(slot, now, now)
    .all<BannerRow>();
  return rows.results ?? [];
}

/* ---- affiliate (mechanic tools) ---- */

export interface AffiliateItemRow {
  id: string;
  title: string;
  imageKey: string | null;
  priceText: string | null;
  source: string;
}

export async function listAffiliateItems(db: D1Database, limit = 24): Promise<AffiliateItemRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, title, image_key AS imageKey, price_text AS priceText, source
       FROM affiliate_items WHERE status = 'active'
       ORDER BY sort_order, created_at DESC LIMIT ${Math.min(limit, 50)}`,
    )
    .all<AffiliateItemRow>();
  return rows.results ?? [];
}

/** The stored outbound URL for /go/:id — ONLY stored URLs are ever redirected to. */
export async function getAffiliateTarget(
  db: D1Database,
  id: string,
): Promise<{ id: string; targetUrl: string } | null> {
  return db
    .prepare(
      `SELECT id, target_url AS targetUrl FROM affiliate_items WHERE id = ? AND status = 'active'`,
    )
    .bind(id)
    .first<{ id: string; targetUrl: string }>();
}

/* ---- checkout pricing (base + cost + stock + campaign candidate per variant) ---- */

export interface CheckoutPricingRow {
  variantId: string;
  name: string;
  priceSatang: number;
  costSatang: number;
  onHand: number;
  /** id of the campaign_prices row (needed for the guarded sold_count increment) */
  campaignPriceId: string | null;
  campaign: CampaignPriceInfo | null;
  /** parcel weight + box dimensions for the shipping-fee calc (dims NULL if unmeasured) */
  weightGrams: number;
  widthMm: number | null;
  lengthMm: number | null;
  heightMm: number | null;
}

/** Authoritative per-variant pricing for checkout re-pricing. Order NOT preserved — match by id. */
export async function getCheckoutPricing(
  db: D1Database,
  variantIds: string[],
  now: number,
): Promise<Map<string, CheckoutPricingRow>> {
  if (variantIds.length === 0) return new Map();
  const rows = await db
    .prepare(
      `SELECT v.id AS variantId, p.name AS name,
              p.weight_grams AS weightGrams,
              p.width_mm AS widthMm, p.length_mm AS lengthMm, p.height_mm AS heightMm,
              COALESCE(pp.online_price_satang, 0) AS priceSatang,
              COALESCE(pp.item_cost_satang, 0) AS costSatang,
              COALESCE((SELECT SUM(quantity_delta) FROM stock_ledger_entries
                        WHERE product_variant_id = v.id), 0) AS onHand,
              cp.id AS campaignPriceId, cp.campaign_price_satang AS cpPriceSatang,
              cg.starts_at AS cpStartsAt, cg.ends_at AS cpEndsAt, cg.status AS cpStatus,
              cp.stock_cap AS cpStockCap, cp.sold_count AS cpSoldCount
       FROM product_variants v
       JOIN products p ON p.id = v.product_id AND p.status = 'active'
       LEFT JOIN pricing_profiles pp ON pp.id =
         (SELECT id FROM pricing_profiles WHERE product_variant_id = v.id
          ORDER BY active_from DESC LIMIT 1)
       LEFT JOIN campaign_prices cp ON cp.id =
         (SELECT cp2.id FROM campaign_prices cp2
            JOIN campaigns cg2 ON cg2.id = cp2.campaign_id
          WHERE cp2.product_variant_id = v.id AND cg2.status = 'active'
            AND cg2.starts_at <= ? AND cg2.ends_at > ?
          ORDER BY cp2.campaign_price_satang ASC LIMIT 1)
       LEFT JOIN campaigns cg ON cg.id = cp.campaign_id
       WHERE v.id IN (${variantIds.map(() => "?").join(",")})`,
    )
    .bind(now, now, ...variantIds)
    .all<{
      variantId: string;
      name: string;
      weightGrams: number;
      widthMm: number | null;
      lengthMm: number | null;
      heightMm: number | null;
      priceSatang: number;
      costSatang: number;
      onHand: number;
      campaignPriceId: string | null;
      cpPriceSatang: number | null;
      cpStartsAt: number | null;
      cpEndsAt: number | null;
      cpStatus: string | null;
      cpStockCap: number | null;
      cpSoldCount: number | null;
    }>();
  const out = new Map<string, CheckoutPricingRow>();
  for (const r of rows.results ?? []) {
    out.set(r.variantId, {
      variantId: r.variantId,
      name: r.name,
      weightGrams: r.weightGrams,
      widthMm: r.widthMm,
      lengthMm: r.lengthMm,
      heightMm: r.heightMm,
      priceSatang: r.priceSatang,
      costSatang: r.costSatang,
      onHand: r.onHand,
      campaignPriceId: r.campaignPriceId,
      campaign:
        r.cpPriceSatang !== null && r.cpStartsAt !== null && r.cpEndsAt !== null
          ? {
              campaignPriceSatang: r.cpPriceSatang,
              startsAt: r.cpStartsAt,
              endsAt: r.cpEndsAt,
              status: r.cpStatus === "active" ? "active" : "disabled",
              stockCap: r.cpStockCap,
              soldCount: r.cpSoldCount ?? 0,
            }
          : null,
    });
  }
  return out;
}

/* ---- coupons (lookup + usage; validation math lives in @l-shopee/core) ---- */

export interface CouponDbRow {
  id: string;
  code: string;
  type: "fixed" | "percent";
  value: number;
  minSubtotalSatang: number;
  startsAt: number | null;
  endsAt: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  status: "active" | "disabled";
}

export async function getCouponWithUsage(
  db: D1Database,
  code: string,
  customerId: string,
): Promise<{ coupon: CouponDbRow; usage: { total: number; byCustomer: number } } | null> {
  const coupon = await db
    .prepare(
      `SELECT id, code, type, value, min_subtotal_satang AS minSubtotalSatang,
              starts_at AS startsAt, ends_at AS endsAt, max_uses AS maxUses,
              max_uses_per_customer AS maxUsesPerCustomer, status
       FROM coupons WHERE code = ? COLLATE NOCASE`,
    )
    .bind(code.trim())
    .first<CouponDbRow>();
  if (!coupon) return null;
  const usage = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN customer_id = ? THEN 1 ELSE 0 END) AS byCustomer
       FROM coupon_redemptions WHERE coupon_id = ?`,
    )
    .bind(customerId, coupon.id)
    .first<{ total: number; byCustomer: number | null }>();
  return { coupon, usage: { total: usage?.total ?? 0, byCustomer: usage?.byCustomer ?? 0 } };
}
