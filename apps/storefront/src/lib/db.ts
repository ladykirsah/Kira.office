import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  D1Database,
  KVNamespace,
  DurableObjectNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";
import type { SortKey } from "./browse";
import type { HeldCouponRow } from "./couponCart";
import type { CategoryRow } from "./groupBySystem";
import { joinDescriptions, productTerms } from "./productDescription";

/**
 * Server-side data access for the storefront: raw SQL over the SAME D1 database as apps/api
 * (matching that Worker's raw-SQL convention — no query builder). Server components and route
 * handlers only; never imported from client components.
 */
export interface StorefrontEnv {
  DB: D1Database;
  KV: KVNamespace;
  /** Shared image bucket (same as apps/api). Holds uploaded bank slips under `slip/`. */
  IMAGES?: R2Bucket;
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

import type { CampaignPriceInfo, CouponAppliesTo, CouponScope } from "@l-shopee/core";

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
  /** How many choices (sizes, product_variants rows) the product has, sold-out ones included;
   *  1 = a normal product. The row itself is the cheapest in-stock choice. */
  choiceCount: number;
  /** The size this row stands for, e.g. "1/2 กลาง" (its flash card names it); null on a normal product. */
  choiceValue: string | null;
}

/** The flat campaign columns a row carries before they are folded into one `campaign` object. */
interface CampaignColumns {
  cpPriceSatang: number | null;
  cpStartsAt: number | null;
  cpEndsAt: number | null;
  cpStatus: string | null;
  cpStockCap: number | null;
  cpSoldCount: number | null;
}

/** Selects the CampaignColumns of the `cp` / `cg` rows joined by CAMPAIGN_JOIN. */
const CAMPAIGN_COLUMNS = `cp.campaign_price_satang AS cpPriceSatang, cg.starts_at AS cpStartsAt,
         cg.ends_at AS cpEndsAt, cg.status AS cpStatus, cp.stock_cap AS cpStockCap,
         cp.sold_count AS cpSoldCount`;

/** Joins variant `v`'s live flash-sale candidate (the cheapest active-window one) as `cp` / `cg`.
 *  Binds TWO `?` (now, now). */
const CAMPAIGN_JOIN = `LEFT JOIN campaign_prices cp ON cp.id =
    (SELECT cp2.id FROM campaign_prices cp2
       JOIN campaigns cg2 ON cg2.id = cp2.campaign_id
     WHERE cp2.product_variant_id = v.id AND cg2.status = 'active'
       AND cg2.starts_at <= ? AND cg2.ends_at > ?
     ORDER BY cp2.campaign_price_satang ASC LIMIT 1)
  LEFT JOIN campaigns cg ON cg.id = cp.campaign_id`;

function toCampaign(c: CampaignColumns): CampaignPriceInfo | null {
  return c.cpPriceSatang !== null && c.cpStartsAt !== null && c.cpEndsAt !== null
    ? {
        campaignPriceSatang: c.cpPriceSatang,
        startsAt: c.cpStartsAt,
        endsAt: c.cpEndsAt,
        status: c.cpStatus === "active" ? "active" : "disabled",
        stockCap: c.cpStockCap,
        soldCount: c.cpSoldCount ?? 0,
      }
    : null;
}

/** Raw row shape before the campaign columns are folded into a nested object. */
type CatalogRow = Omit<CatalogItem, "campaign"> & CampaignColumns;

/**
 * ONE row per active product: its representative choice — the in-stock variant (ledger sum > 0)
 * with the lowest price the shopper pays now (a live flash price, else the latest online price),
 * ties by created_at then id. A product with no size in stock has no row. This is the single choke
 * point for listCatalog / bestSellers / getProduct, so an out-of-stock product vanishes from grids
 * AND its PDP (404), and reappears automatically the moment any size is restocked.
 *
 * Binds CATALOG_NOW_BINDS `?` (now, epoch ms) — callers bind them first.
 */
const CATALOG_SELECT = `
  SELECT p.id AS productId, v.id AS variantId, p.name AS name, p.product_ref AS productRef,
         b.name AS brandName, t.name AS typeName, t.warranty_days AS warrantyDays, p.image_key AS imageKey,
         COALESCE(pp.online_price_satang, 0) AS priceSatang,
         COALESCE((SELECT SUM(quantity_delta) FROM stock_ledger_entries WHERE product_variant_id = v.id), 0) AS onHand,
         (SELECT TRIM(COALESCE(f.car_brand, '') || ' ' || COALESCE(f.car_model, ''))
            FROM product_fitments f WHERE f.product_id = p.id
            ORDER BY f.sort_order LIMIT 1) AS fitmentShort,
         (SELECT COUNT(*) FROM product_variants cv WHERE cv.product_id = p.id) AS choiceCount,
         v.option_1_value AS choiceValue,
         ${CAMPAIGN_COLUMNS}
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  LEFT JOIN pricing_profiles pp ON pp.id =
    (SELECT id FROM pricing_profiles WHERE product_variant_id = v.id ORDER BY active_from DESC LIMIT 1)
  ${CAMPAIGN_JOIN}
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_types t ON t.id = p.type_id
  WHERE p.status = 'active'
    AND v.id = (SELECT rv.id FROM product_variants rv
                 WHERE rv.product_id = p.id
                   AND (SELECT COALESCE(SUM(quantity_delta), 0)
                          FROM stock_ledger_entries WHERE product_variant_id = rv.id) > 0
                 ORDER BY COALESCE((SELECT MIN(rcp.campaign_price_satang) FROM campaign_prices rcp
                                      JOIN campaigns rcg ON rcg.id = rcp.campaign_id
                                     WHERE rcp.product_variant_id = rv.id AND rcg.status = 'active'
                                       AND rcg.starts_at <= ? AND rcg.ends_at > ?),
                                   (SELECT online_price_satang FROM pricing_profiles
                                     WHERE product_variant_id = rv.id
                                     ORDER BY active_from DESC LIMIT 1), 0),
                          rv.created_at, rv.id
                 LIMIT 1)`;
const CATALOG_NOW_BINDS = 4;
const BEST_SELLER_DAYS = 90;

/** ORDER BY per sort. Price is what the shopper pays now (an active flash price wins); ties fall back
 *  to the newest change so the order never jumps between visits. */
const CATALOG_ORDER: Record<SortKey, string> = {
  relevant: "COALESCE(p.updated_at, p.created_at) DESC, p.id",
  new: "p.created_at DESC, p.id",
  price_asc:
    "COALESCE(cp.campaign_price_satang, pp.online_price_satang, 0) ASC, COALESCE(p.updated_at, p.created_at) DESC",
  price_desc:
    "COALESCE(cp.campaign_price_satang, pp.online_price_satang, 0) DESC, COALESCE(p.updated_at, p.created_at) DESC",
  best: `(SELECT COALESCE(SUM(l.quantity), 0) FROM sales_order_lines l
            JOIN sales_orders o ON o.id = l.sales_order_id
            JOIN product_variants lv ON lv.id = l.product_variant_id
           WHERE lv.product_id = p.id AND o.channel = 'airplus' AND o.order_created_at >= ?) DESC,
         COALESCE(p.updated_at, p.created_at) DESC`,
};

function toCatalogItem(row: CatalogRow): CatalogItem {
  const { cpPriceSatang, cpStartsAt, cpEndsAt, cpStatus, cpStockCap, cpSoldCount, ...item } = row;
  const campaign = toCampaign({
    cpPriceSatang,
    cpStartsAt,
    cpEndsAt,
    cpStatus,
    cpStockCap,
    cpSoldCount,
  });
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
    /** board 2 sort bar: เกี่ยวข้อง (default) · ขายดี · ใหม่ · ราคา ↑/↓ */
    sort?: SortKey;
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
  const sort = opts.sort ?? "relevant";
  // ขายดี ranks by AirPlus units sold in the last 90 days (same window as the home ขายดี list).
  const orderBinds = sort === "best" ? [now - BEST_SELLER_DAYS * 24 * 60 * 60 * 1000] : [];
  const rows = await db
    .prepare(`${CATALOG_SELECT}${where} ORDER BY ${CATALOG_ORDER[sort]} LIMIT ${limit}`)
    .bind(...Array(CATALOG_NOW_BINDS).fill(now), ...binds, ...orderBinds)
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

/** Best sellers: top products by units sold on AirPlus orders in the window (every size of a product
 *  counts toward it); newest fill gaps. Each item carries `monthlySales` (units sold ÷ months in the
 *  window) for the ranked list's metric. */
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
      `SELECT v.product_id AS productId, SUM(l.quantity) AS sold
       FROM sales_order_lines l JOIN sales_orders o ON o.id = l.sales_order_id
       JOIN product_variants v ON v.id = l.product_variant_id
       WHERE o.channel = 'airplus' AND o.order_created_at >= ?
       GROUP BY v.product_id ORDER BY sold DESC LIMIT ${limit}`,
    )
    .bind(since)
    .all<{ productId: string; sold: number }>();
  const soldBy = new Map((top.results ?? []).map((r) => [r.productId, r.sold]));
  const ranked = [...soldBy.keys()];
  // sold > 0 shows at least "1/เดือน" (never a misleading "0"); no history → null (hide the metric).
  const monthly = (productId: string): number | null => {
    const sold = soldBy.get(productId);
    return sold != null ? Math.max(1, Math.round(sold / months)) : null;
  };
  if (ranked.length === 0) {
    return (await listCatalog(db, { limit })).map((i) => ({ ...i, monthlySales: null }));
  }
  const rows = await db
    .prepare(`${CATALOG_SELECT} AND p.id IN (${ranked.map(() => "?").join(",")})`)
    .bind(...Array(CATALOG_NOW_BINDS).fill(now), ...ranked)
    .all<CatalogRow>();
  const byId = new Map((rows.results ?? []).map((r) => [r.productId, toCatalogItem(r)]));
  const ordered: BestSeller[] = ranked
    .map((id) => byId.get(id))
    .filter((x): x is CatalogItem => Boolean(x))
    .map((item) => ({ ...item, monthlySales: monthly(item.productId) }));
  if (ordered.length < limit) {
    const have = new Set(ordered.map((i) => i.productId));
    const fill = (await listCatalog(db, { limit }))
      .filter((i) => !have.has(i.productId))
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
): Promise<
  {
    brand: string;
    nameTh: string | null;
    nameEn: string | null;
    productCount: number;
    imageKey: string | null;
  }[]
> {
  const rows = await db
    .prepare(
      // The tile list is the OWNER'S car-brand taxonomy (Kira.office -> Car fitment), not just the
      // makes that happen to have stock — the owner wants their full coverage visible while the
      // catalogue is still being listed, "0 รายการ" included.
      //
      // The `union` arm keeps a product visible if it is fitted to a make the taxonomy has never
      // heard of (fitment.car_brand is free text). Without it, deleting a taxonomy row would
      // silently hide real products.
      //
      // productCount still counts only ACTIVE + IN-STOCK products so it matches the catalogue. That
      // condition must live inside the CASE, not in a WHERE — a WHERE would collapse the LEFT JOINs
      // back to inner joins and drop the zero-count makes this query exists to show.
      `WITH makes AS (
         SELECT name, name_th, name_en, image_key, sort_order FROM car_brands
         UNION
         -- A make referenced only by free-text fitment has no taxonomy row, so no translations.
         SELECT DISTINCT f.car_brand, NULL, NULL, NULL, 9999 FROM product_fitments f
          WHERE TRIM(COALESCE(f.car_brand, '')) != ''
            AND f.car_brand NOT IN (SELECT name FROM car_brands)
       )
       SELECT m.name AS brand, m.name_th AS nameTh, m.name_en AS nameEn, m.image_key AS imageKey,
              COUNT(DISTINCT CASE WHEN p.status = 'active' AND EXISTS (
                      SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
                       AND (SELECT COALESCE(SUM(quantity_delta), 0)
                              FROM stock_ledger_entries WHERE product_variant_id = pv.id) > 0)
                   THEN p.id END) AS productCount
         FROM makes m
         LEFT JOIN product_fitments f ON f.car_brand = m.name
         LEFT JOIN products p ON p.id = f.product_id
        GROUP BY m.name, m.name_th, m.name_en, m.image_key, m.sort_order
        -- in-stock makes first, so a length-limited row (home) still leads with the useful ones
        ORDER BY productCount DESC, m.sort_order, m.name
        LIMIT ${Math.min(limit, 64)}`,
    )
    .all<{
      brand: string;
      nameTh: string | null;
      nameEn: string | null;
      productCount: number;
      imageKey: string | null;
    }>();
  return rows.results ?? [];
}

/** One car model era for the รถของฉัน model sheet (board 1 · 1.3): the owner's taxonomy row plus how
 *  many active, in-stock products are fitted to that brand + model (any year). */
export interface CarModelOption {
  brand: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  productCount: number;
}

/** Every model in the owner's car taxonomy (Kira.office → Car fitment), grouped later by brand on
 *  the client. Models with no products still show ("0 รายการ" is the owner's full coverage). */
export async function carModelOptions(db: D1Database): Promise<CarModelOption[]> {
  const rows = await db
    .prepare(
      `SELECT b.name AS brand, m.name AS model, m.year_from AS yearFrom, m.year_to AS yearTo,
              (SELECT COUNT(DISTINCT p.id) FROM product_fitments f
                 JOIN products p ON p.id = f.product_id AND p.status = 'active'
                WHERE f.car_brand = b.name AND f.car_model = m.name
                  AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
                    AND (SELECT COALESCE(SUM(quantity_delta), 0)
                           FROM stock_ledger_entries WHERE product_variant_id = pv.id) > 0)
              ) AS productCount
         FROM car_models m JOIN car_brands b ON b.id = m.car_brand_id
        ORDER BY b.sort_order, b.name, m.sort_order, m.year_from, m.name`,
    )
    .all<CarModelOption>();
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
export async function listProductTypes(db: D1Database): Promise<CategoryRow[]> {
  const rows = await db
    .prepare(
      // EVERY category the owner has defined surfaces, including ones with nothing in stock yet
      // ("0 รายการ" is fine) — same decision as the car-brand tiles: show the full range while the
      // catalogue is being listed.
      //
      // productCount still counts only ACTIVE + IN-STOCK products so it matches the catalogue. That
      // condition must live inside the CASE, not in a WHERE — a WHERE would collapse the LEFT JOINs
      // back to inner joins and the empty categories would disappear again.
      //
      // usage_id (migration 0064) is joined so the categories index can group by car system; ordering
      // by the system's sort_order first keeps each system's categories together.
      `SELECT t.id, t.name, t.name_th AS nameTh, t.name_en AS nameEn, t.image_key AS imageKey,
              t.usage_id AS usageId, u.name AS systemName, u.name_th AS systemNameTh,
              u.name_en AS systemNameEn,
              COUNT(DISTINCT CASE WHEN p.status = 'active' AND (
                      SELECT COALESCE(SUM(quantity_delta), 0)
                        FROM stock_ledger_entries WHERE product_variant_id = v.id) > 0
                   THEN p.id END) AS productCount
         FROM product_types t
         LEFT JOIN usage_categories u ON u.id = t.usage_id
         LEFT JOIN products p ON p.type_id = t.id
         LEFT JOIN product_variants v ON v.product_id = p.id
        GROUP BY t.id, t.name, t.name_th, t.name_en, t.image_key, t.sort_order,
                 t.usage_id, u.name, u.name_th, u.name_en, u.sort_order
        ORDER BY u.sort_order, u.name, t.sort_order, t.name`,
    )
    .all<CategoryRow>();
  return rows.results ?? [];
}

/* ---- product detail ---- */

export interface ProductDetail extends CatalogItem {
  description: string | null;
  /** Its category's เงื่อนไข, filled in for this product; null = no เงื่อนไข box. */
  terms: string | null;
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
  /** Every choice (size) of the product in the back office's order, sold-out ones included. A normal
   *  product has exactly one, with a null optionName and value. */
  choices: StorefrontChoice[];
}

/** One choice (size) of a product: a product_variants row with its own code, price and stock. */
export interface StorefrontChoice {
  variantId: string;
  /** the option's name, e.g. "ขนาด" (null on a normal product) */
  optionName: string | null;
  /** the choice, e.g. "3/8 เล็ก" (null on a normal product) */
  value: string | null;
  /** its barcode / product code */
  code: string | null;
  /** its own photo, else the product's first photo */
  imageKey: string | null;
  /** BASE online price (latest pricing row), 0 when it has none */
  priceSatang: number;
  /** units on hand (ledger sum, never below 0); 0 = sold out */
  onHand: number;
  /** live flash-sale candidate for this choice (cheapest active-window one), or null */
  campaign: CampaignPriceInfo | null;
}

/** All of a product's choices, ordered the way the back office lists them (created_at, id). */
async function productChoices(
  db: D1Database,
  productId: string,
  now: number,
): Promise<StorefrontChoice[]> {
  const rows = await db
    .prepare(
      `SELECT v.id AS variantId, v.option_1_name AS optionName, v.option_1_value AS value,
              v.barcode_primary AS code, COALESCE(v.image_key, p.image_key) AS imageKey,
              COALESCE((SELECT online_price_satang FROM pricing_profiles
                         WHERE product_variant_id = v.id
                         ORDER BY active_from DESC LIMIT 1), 0) AS priceSatang,
              MAX(COALESCE((SELECT SUM(quantity_delta) FROM stock_ledger_entries
                             WHERE product_variant_id = v.id), 0), 0) AS onHand,
              ${CAMPAIGN_COLUMNS}
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       ${CAMPAIGN_JOIN}
       WHERE v.product_id = ?
       ORDER BY v.created_at, v.id`,
    )
    .bind(now, now, productId)
    .all<Omit<StorefrontChoice, "campaign"> & CampaignColumns>();
  return (rows.results ?? []).map(
    ({ cpPriceSatang, cpStartsAt, cpEndsAt, cpStatus, cpStockCap, cpSoldCount, ...choice }) => ({
      ...choice,
      campaign: toCampaign({
        cpPriceSatang,
        cpStartsAt,
        cpEndsAt,
        cpStatus,
        cpStockCap,
        cpSoldCount,
      }),
    }),
  );
}

export async function getProduct(db: D1Database, productId: string): Promise<ProductDetail | null> {
  const now = Date.now();
  const headRow = await db
    .prepare(`${CATALOG_SELECT} AND p.id = ? LIMIT 1`)
    .bind(...Array(CATALOG_NOW_BINDS).fill(now), productId)
    .first<CatalogRow>();
  const head = headRow ? toCatalogItem(headRow) : null;
  if (!head) return null;
  const [meta, images, fitments, choices] = await Promise.all([
    db
      .prepare(
        `SELECT p.description AS description, pt.description AS categoryDescription, pt.terms AS categoryTerms,
                p.weight_grams AS weightGrams, COALESCE(tp.price_includes_vat, 1) AS priceIncludesVat
         FROM products p LEFT JOIN tax_profiles tp ON tp.id = p.tax_profile_id
         LEFT JOIN product_types pt ON pt.id = p.type_id WHERE p.id = ?`,
      )
      .bind(productId)
      .first<{
        description: string | null;
        categoryDescription: string | null;
        categoryTerms: string | null;
        weightGrams: number;
        priceIncludesVat: number;
      }>(),
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
    productChoices(db, productId, now),
  ]);
  return {
    ...head,
    choices,
    description: joinDescriptions(meta?.description ?? null, meta?.categoryDescription ?? null),
    terms: productTerms(meta?.categoryTerms ?? null, head),
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
  /** outbound clicks so far — the card's social proof (see lib/affiliateInterest) */
  clicks: number;
}

export async function listAffiliateItems(db: D1Database, limit = 24): Promise<AffiliateItemRow[]> {
  const rows = await db
    .prepare(
      `SELECT a.id, a.title, a.image_key AS imageKey, a.price_text AS priceText, a.source,
              (SELECT COUNT(*) FROM affiliate_clicks k WHERE k.item_id = a.id) AS clicks
       FROM affiliate_items a WHERE a.status = 'active'
       ORDER BY a.pinned DESC, a.sort_order, a.created_at DESC LIMIT ${Math.min(limit, 50)}`,
    )
    .all<AffiliateItemRow>();
  return rows.results ?? [];
}

/** A tool card carrying the category it is filed under — what /tools groups by. */
export interface AffiliateFiledRow extends AffiliateItemRow {
  categoryName: string | null;
}

/**
 * Every active tool card WITH its category, for the /tools shelf.
 *
 * Ordered by clicks so the busiest card leads its section (and, via groupToolsByCategory, the
 * busiest category leads the page). Unfiled cards come back too — dropping them is the grouping
 * layer's job, so the same query can serve a page that shows them if that call is ever reversed.
 */
export async function listFiledAffiliateItems(db: D1Database): Promise<AffiliateFiledRow[]> {
  const rows = await db
    .prepare(
      `SELECT a.id, a.title, a.image_key AS imageKey, a.price_text AS priceText, a.source,
              c.name AS categoryName,
              (SELECT COUNT(*) FROM affiliate_clicks k WHERE k.item_id = a.id) AS clicks
       FROM affiliate_items a
       LEFT JOIN affiliate_categories c ON c.id = a.category_id
       WHERE a.status = 'active'
       ORDER BY clicks DESC, a.sort_order, a.created_at DESC`,
    )
    .all<AffiliateFiledRow>();
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
  /** what the product is, for coupons only for a brand / category / car model / picked products */
  productId: string;
  brandId: string | null;
  categoryId: string | null;
  carModelIds: string[];
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
              p.id AS productId, p.brand_id AS brandId, p.type_id AS categoryId,
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
      productId: string;
      brandId: string | null;
      categoryId: string | null;
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
  const models = await carModelsFitted(
    db,
    (rows.results ?? []).map((r) => r.productId),
  );
  const out = new Map<string, CheckoutPricingRow>();
  for (const r of rows.results ?? []) {
    out.set(r.variantId, {
      variantId: r.variantId,
      name: r.name,
      productId: r.productId,
      brandId: r.brandId,
      categoryId: r.categoryId,
      carModelIds: models.get(r.productId) ?? [],
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

/**
 * The car models each product fits. A fitment names its car by brand and model (free text from the
 * product form); it matches the managed car_models row of that name under that brand.
 */
async function carModelsFitted(
  db: D1Database,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  const { results } = await db
    .prepare(
      `SELECT DISTINCT pf.product_id AS productId, cm.id AS carModelId
       FROM product_fitments pf
       JOIN car_models cm ON cm.name = pf.car_model COLLATE NOCASE
       LEFT JOIN car_brands cb ON cb.id = cm.car_brand_id
       WHERE pf.product_id IN (${ids.map(() => "?").join(",")})
         AND (pf.car_brand IS NULL OR cb.name = pf.car_brand COLLATE NOCASE)`,
    )
    .bind(...ids)
    .all<{ productId: string; carModelId: string }>();
  const out = new Map<string, string[]>();
  for (const r of results ?? [])
    out.set(r.productId, [...(out.get(r.productId) ?? []), r.carModelId]);
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
  maxDiscountSatang: number | null;
  status: "active" | "disabled";
  appliesTo: CouponAppliesTo;
  scope: CouponScope;
  targets: string[];
  signupFrom: number | null;
  signupTo: number | null;
  validDays: number | null;
}

export async function getCouponWithUsage(
  db: D1Database,
  code: string,
  customerId: string,
): Promise<{
  coupon: CouponDbRow;
  usage: { total: number; byCustomer: number };
  /** when the customer's account was made — a ลูกค้าใหม่ coupon is held by its window */
  holder: { createdAt: number } | undefined;
} | null> {
  const row = await db
    .prepare(
      `SELECT id, code, type, value, min_subtotal_satang AS minSubtotalSatang,
              starts_at AS startsAt, ends_at AS endsAt, max_uses AS maxUses,
              max_uses_per_customer AS maxUsesPerCustomer,
              max_discount_satang AS maxDiscountSatang, status,
              applies_to AS appliesTo, scope, signup_from AS signupFrom, signup_to AS signupTo,
              valid_days AS validDays
       FROM coupons WHERE code = ? COLLATE NOCASE`,
    )
    .bind(code.trim())
    .first<Omit<CouponDbRow, "targets">>();
  if (!row) return null;
  const [targets, holder] = await Promise.all([
    db
      .prepare("SELECT target_id AS id FROM coupon_targets WHERE coupon_id = ?")
      .bind(row.id)
      .all<{ id: string }>(),
    db
      .prepare("SELECT created_at AS createdAt FROM storefront_customers WHERE id = ?")
      .bind(customerId)
      .first<{ createdAt: number }>(),
  ]);
  const coupon: CouponDbRow = { ...row, targets: (targets.results ?? []).map((t) => t.id) };
  const usage = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN customer_id = ? THEN 1 ELSE 0 END) AS byCustomer
       FROM coupon_redemptions WHERE coupon_id = ?`,
    )
    .bind(customerId, coupon.id)
    .first<{ total: number; byCustomer: number | null }>();
  return {
    coupon,
    usage: { total: usage?.total ?? 0, byCustomer: usage?.byCustomer ?? 0 },
    holder: holder ?? undefined,
  };
}

/**
 * The ลูกค้าใหม่ coupons whose sign-up window holds this customer's join date, with how often they
 * have been used (by everyone and by this customer). `myCoupons` decides which are still theirs.
 */
export async function listHeldCoupons(
  db: D1Database,
  customerId: string,
): Promise<{ joinedAt: number; rows: HeldCouponRow[] } | null> {
  const customer = await db
    .prepare("SELECT created_at AS joinedAt FROM storefront_customers WHERE id = ?")
    .bind(customerId)
    .first<{ joinedAt: number }>();
  if (!customer) return null;
  const { results } = await db
    .prepare(
      `SELECT c.code, c.type, c.value, c.min_subtotal_satang AS minSubtotalSatang,
              c.max_discount_satang AS maxDiscountSatang, c.applies_to AS appliesTo, c.scope,
              c.signup_from AS signupFrom, c.signup_to AS signupTo, c.valid_days AS validDays,
              c.max_uses AS maxUses, c.max_uses_per_customer AS maxUsesPerCustomer,
              (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS total,
              (SELECT COUNT(*) FROM coupon_redemptions r
                WHERE r.coupon_id = c.id AND r.customer_id = ?) AS byCustomer
       FROM coupons c
       WHERE c.status = 'active' AND c.signup_from IS NOT NULL
         AND ? BETWEEN c.signup_from AND c.signup_to`,
    )
    .bind(customerId, customer.joinedAt)
    .all<HeldCouponRow>();
  return { joinedAt: customer.joinedAt, rows: results ?? [] };
}
