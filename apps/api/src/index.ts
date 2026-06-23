import { DurableObject } from "cloudflare:workers";
import {
  computeSaleProfit,
  partitionByClientUuid,
  parseCsv,
  mapRows,
  dedupeOrders,
  orderKey,
  type RowError,
  type SaleLineInput,
} from "@l-shopee/core";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  STOCK_LEDGER: DurableObjectNamespace<StockLedger>;
  IMAGES: R2Bucket;
}

interface SyncLine {
  productVariantId: string;
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang?: number;
  taxSatang?: number;
  unitCostSatang?: number;
}

interface SyncSale {
  clientUuid: string;
  paymentMethod?: string;
  lines: SyncLine[];
}

interface SyncConflict {
  productVariantId: string;
  requested: number;
  available: number;
}

export interface SyncResult {
  applied: number;
  duplicates: number;
  conflicts: SyncConflict[];
}

const json = (data: unknown, status = 200): Response => Response.json(data, { status });

/**
 * Per-line gross profit in satang for an on-site sale line: (price·qty − discount − tax) − cost·qty.
 * Tax is the VAT portion the line carries (POS computes it via @l-shopee/core); revenue is ex-VAT.
 */
export function lineGrossProfitSatang(line: SyncLine): number {
  const gross = line.unitPriceSatang * line.quantity;
  const revenueExTax = gross - (line.discountSatang ?? 0) - (line.taxSatang ?? 0);
  const cost = (line.unitCostSatang ?? 0) * line.quantity;
  return revenueExTax - cost;
}

/**
 * Idempotent offline-sale persistence against D1. Dedupes by client_uuid (server-applied + in-batch),
 * applies stock as ledger deltas (blocking oversell, surfaced as conflicts), and writes sale + lines
 * + ledger in one D1 batch. Always invoked through the StockLedger Durable Object so concurrent syncs
 * serialize (single writer); D1's unique index on client_uuid is the backstop against double-counting.
 */
export async function applySyncToDb(db: D1Database, sales: SyncSale[]): Promise<SyncResult> {
  if (sales.length === 0) return { applied: 0, duplicates: 0, conflicts: [] };

  const uuids = sales.map((s) => s.clientUuid);
  const existingRows = await db
    .prepare(
      `SELECT client_uuid AS clientUuid FROM onsite_sales WHERE client_uuid IN (${uuids.map(() => "?").join(",")})`,
    )
    .bind(...uuids)
    .all<{ clientUuid: string }>();
  const existing = (existingRows.results ?? []).map((r) => r.clientUuid);
  const { fresh, duplicates } = partitionByClientUuid(existing, sales);
  if (fresh.length === 0) {
    return { applied: 0, duplicates: duplicates.length, conflicts: [] };
  }

  const variantIds = [...new Set(fresh.flatMap((s) => s.lines.map((l) => l.productVariantId)))];
  const available: Record<string, number> = {};
  for (const id of variantIds) available[id] = 0;
  if (variantIds.length > 0) {
    const availRows = await db
      .prepare(
        `SELECT product_variant_id AS variantId, COALESCE(SUM(quantity_delta), 0) AS available
         FROM stock_ledger_entries WHERE product_variant_id IN (${variantIds.map(() => "?").join(",")})
         GROUP BY product_variant_id`,
      )
      .bind(...variantIds)
      .all<{ variantId: string; available: number }>();
    for (const row of availRows.results ?? []) available[row.variantId] = Number(row.available);
  }

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  const conflicts: SyncConflict[] = [];
  let applied = 0;

  for (const sale of fresh) {
    const saleId = crypto.randomUUID();
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const lineStatements: D1PreparedStatement[] = [];

    for (const line of sale.lines) {
      subtotal += line.unitPriceSatang * line.quantity;
      discountTotal += line.discountSatang ?? 0;
      taxTotal += line.taxSatang ?? 0;

      const current = available[line.productVariantId] ?? 0;
      const after = current - line.quantity;
      if (after < 0) {
        conflicts.push({
          productVariantId: line.productVariantId,
          requested: line.quantity,
          available: current,
        });
        continue; // oversell: skip this line's stock movement, surface for review
      }
      available[line.productVariantId] = after;

      lineStatements.push(
        db
          .prepare(
            `INSERT INTO onsite_sale_lines
             (id, onsite_sale_id, product_variant_id, barcode_value, quantity, unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            saleId,
            line.productVariantId,
            line.barcodeValue ?? null,
            line.quantity,
            line.unitPriceSatang,
            line.discountSatang ?? 0,
            line.taxSatang ?? 0,
            line.unitCostSatang ?? 0,
            lineGrossProfitSatang(line),
          ),
        db
          .prepare(
            `INSERT INTO stock_ledger_entries
             (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, source_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            line.productVariantId,
            "onsite_sale",
            -line.quantity,
            after,
            "onsite_sale",
            saleId,
            now,
          ),
      );
    }

    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO onsite_sales
           (id, client_uuid, payment_method, sync_status, subtotal_satang, discount_total_satang, tax_total_satang, grand_total_satang, sale_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          saleId,
          sale.clientUuid,
          sale.paymentMethod ?? null,
          "synced",
          subtotal,
          discountTotal,
          taxTotal,
          subtotal - discountTotal,
          "completed",
          now,
        ),
      ...lineStatements,
    );
    applied += 1;
  }

  if (statements.length > 0) await db.batch(statements);
  return { applied, duplicates: duplicates.length, conflicts };
}

/**
 * Stock-ledger Durable Object: the single serialized writer for stock-affecting operations. One
 * instance per shop means concurrent /sync batches (and future online-order applies) are processed
 * one at a time, so oversell races can't occur. See docs/CLOUDFLARE_ARCHITECTURE.md.
 */
export class StockLedger extends DurableObject<Env> {
  async applySync(sales: SyncSale[]): Promise<SyncResult> {
    return applySyncToDb(this.env.DB, sales);
  }
}

export interface ImportResult {
  /** Data rows seen (excludes the header). */
  received: number;
  /** Rows that mapped to a valid product (re-import is idempotent on product_code). */
  valid: number;
  /** Rows skipped for a missing required field. */
  invalid: number;
  errors: RowError[];
}

/**
 * Import products from a CSV (e.g. a Google Sheet export). `mapping` maps fields to header columns;
 * `product_code` + `name` are required. Idempotent: INSERT OR IGNORE on the unique product_code, so
 * re-importing the same file does not create duplicates. Variants/barcodes/pricing follow later.
 */
export async function importProducts(
  db: D1Database,
  csv: string,
  mapping: Record<string, string>,
): Promise<ImportResult> {
  const rows = parseCsv(csv);
  const { records, errors } = mapRows(rows, mapping, ["product_code", "name"]);
  const now = Date.now();
  const statements = records.map((r) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO products (id, product_code, name, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        r["product_code"] ?? "",
        r["name"] ?? "",
        r["description"] ?? null,
        "active",
        now,
      ),
  );
  if (statements.length > 0) await db.batch(statements);
  return {
    received: Math.max(0, rows.length - 1),
    valid: records.length,
    invalid: errors.length,
    errors,
  };
}

export interface OrderImportResult {
  received: number;
  /** Fresh orders inserted (deduped vs already-imported + in-batch). */
  imported: number;
  duplicates: number;
  invalid: number;
  errors: RowError[];
}

/**
 * Import Shopee orders from a Seller Centre CSV export (the bridge before the live v2 API). Required
 * field: `external_order_id`. Deduped by (channel, external_order_id) via core.dedupeOrders + an
 * INSERT OR IGNORE on the unique index, so re-importing the same export never creates duplicates.
 * Records order headers/status; full order lines + profit come from the API phase.
 */
export async function importShopeeOrders(
  db: D1Database,
  csv: string,
  mapping: Record<string, string>,
): Promise<OrderImportResult> {
  const rows = parseCsv(csv);
  const { records, errors } = mapRows(rows, mapping, ["external_order_id"]);
  const incoming = records.map((r) => ({
    channel: "shopee" as const,
    externalOrderId: r["external_order_id"] ?? "",
    orderStatus: r["order_status"] ?? null,
    paymentStatus: r["payment_status"] ?? null,
  }));

  let existingKeys: string[] = [];
  const ids = incoming.map((o) => o.externalOrderId);
  if (ids.length > 0) {
    const existingRows = await db
      .prepare(
        `SELECT external_order_id AS id FROM sales_orders WHERE channel = 'shopee' AND external_order_id IN (${ids.map(() => "?").join(",")})`,
      )
      .bind(...ids)
      .all<{ id: string }>();
    existingKeys = (existingRows.results ?? []).map((r) =>
      orderKey({ channel: "shopee", externalOrderId: r.id }),
    );
  }

  const { fresh, duplicates } = dedupeOrders(existingKeys, incoming);
  const now = Date.now();
  const statements = fresh.map((o) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, imported_at, import_source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        o.channel,
        o.externalOrderId,
        o.orderStatus,
        o.paymentStatus,
        now,
        "csv",
      ),
  );
  if (statements.length > 0) await db.batch(statements);
  return {
    received: Math.max(0, rows.length - 1),
    imported: fresh.length,
    duplicates: duplicates.length,
    invalid: errors.length,
    errors,
  };
}

export interface CreateProductInput {
  productCode: string;
  name: string;
  description?: string;
  barcode?: string;
}

export interface CreateProductResult {
  productId: string;
  /** null when the product already existed (created=false). */
  variantId: string | null;
  created: boolean;
}

/**
 * Create a product + a default variant (sku = product_code) and, if a barcode is given, a primary
 * barcode — in one D1 batch. Idempotent: returns the existing product (created=false) if the
 * product_code is already used, so no orphan variants are produced. Throws on missing code/name.
 */
export async function createProduct(
  db: D1Database,
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const code = input.productCode.trim();
  const name = input.name.trim();
  if (!code || !name) throw new Error("productCode and name are required");

  const existing = await db
    .prepare("SELECT id FROM products WHERE product_code = ?")
    .bind(code)
    .first<{ id: string }>();
  if (existing) return { productId: existing.id, variantId: null, created: false };

  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const barcode = input.barcode?.trim();
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO products (id, product_code, name, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(productId, code, name, input.description?.trim() || null, "active", now),
    db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, barcode_primary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(variantId, productId, code, barcode || null, "active", now),
  ];
  if (barcode) {
    statements.push(
      db
        .prepare(
          `INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), variantId, barcode, 1, 0, now),
    );
  }
  await db.batch(statements);
  return { productId, variantId, created: true };
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadImageResult {
  key: string;
  url: string;
}

/**
 * Store a product image in the R2 images bucket and record its key on the product. Validates the
 * content type (jpeg/png/webp) and size (≤5MB). The bytes are served back via GET /img/:key.
 */
export async function storeProductImage(
  db: D1Database,
  bucket: R2Bucket,
  productId: string,
  bytes: ArrayBuffer,
  contentType: string | null,
): Promise<UploadImageResult> {
  if (!contentType || !ALLOWED_IMAGE_TYPES[contentType]) {
    throw new Error("unsupported image type (use jpeg, png or webp)");
  }
  if (bytes.byteLength === 0) throw new Error("empty image");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large (max 5MB)");

  const key = `products/${productId}/${crypto.randomUUID()}.${ALLOWED_IMAGE_TYPES[contentType]}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  await db.prepare("UPDATE products SET image_key = ? WHERE id = ?").bind(key, productId).run();
  return { key, url: `/img/${key}` };
}

async function listProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, product_code AS productCode, name, status, image_key AS imageKey FROM products ORDER BY created_at DESC LIMIT 100",
  ).all();
  return json({ products: results });
}

export interface SaleExportRow {
  paymentMethod: string | null;
  grandTotalSatang: number;
  taxTotalSatang: number;
  grossProfitSatang: number;
  saleStatus: string;
  createdAt: number;
}

const SALES_SELECT = `SELECT s.id,
        s.payment_method AS paymentMethod,
        s.grand_total_satang AS grandTotalSatang,
        s.tax_total_satang AS taxTotalSatang,
        s.sale_status AS saleStatus,
        s.created_at AS createdAt,
        COALESCE(
          (SELECT SUM(gross_profit_satang) FROM onsite_sale_lines WHERE onsite_sale_id = s.id),
          0
        ) AS grossProfitSatang
 FROM onsite_sales s
 ORDER BY s.created_at DESC
 LIMIT 100`;

/** Recent on-site sales with their aggregated gross profit (for the sales/finance views). */
async function querySales(db: D1Database): Promise<SaleExportRow[]> {
  const { results } = await db.prepare(SALES_SELECT).all<SaleExportRow>();
  return results ?? [];
}

async function listSales(env: Env): Promise<Response> {
  return json({ sales: await querySales(env.DB) });
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const thb = (satang: number): string => (satang / 100).toFixed(2);

/** Render sales as accounting CSV (THB). Pure + tested; served by GET /sales/export.csv. */
export function salesToCsv(rows: SaleExportRow[]): string {
  const header = "date,payment_method,total_thb,vat_thb,gross_profit_thb,status";
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      csvCell(r.paymentMethod ?? ""),
      thb(r.grandTotalSatang),
      thb(r.taxTotalSatang),
      thb(r.grossProfitSatang),
      csvCell(r.saleStatus),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export interface BarcodeLookup {
  barcode: string;
  variantId: string;
  productId: string;
  productCode: string;
  name: string;
}

/** Resolve a scanned barcode to its variant + product (for the POS). Returns null if unknown. */
export async function lookupBarcode(db: D1Database, code: string): Promise<BarcodeLookup | null> {
  const row = await db
    .prepare(
      `SELECT b.barcode_value AS barcode,
              v.id AS variantId,
              p.id AS productId,
              p.product_code AS productCode,
              p.name AS name
       FROM barcodes b
       JOIN product_variants v ON v.id = b.product_variant_id
       JOIN products p ON p.id = v.product_id
       WHERE b.barcode_value = ?
       LIMIT 1`,
    )
    .bind(code)
    .first<BarcodeLookup>();
  return row ?? null;
}

export interface ProductDetail {
  product: {
    id: string;
    productCode: string;
    name: string;
    description: string | null;
    status: string;
    imageKey: string | null;
  };
  variantId: string | null;
  pricing: { itemCostSatang: number; targetPriceSatang: number } | null;
}

/** Product detail for the edit screen: the product, its default variant, and that variant's pricing. */
export async function getProductDetail(db: D1Database, id: string): Promise<ProductDetail | null> {
  const product = await db
    .prepare(
      "SELECT id, product_code AS productCode, name, description, status, image_key AS imageKey FROM products WHERE id = ?",
    )
    .bind(id)
    .first<ProductDetail["product"]>();
  if (!product) return null;
  const variant = await db
    .prepare("SELECT id FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1")
    .bind(id)
    .first<{ id: string }>();
  let pricing: ProductDetail["pricing"] = null;
  if (variant) {
    pricing =
      (await db
        .prepare(
          "SELECT item_cost_satang AS itemCostSatang, target_price_satang AS targetPriceSatang FROM pricing_profiles WHERE product_variant_id = ? ORDER BY active_from DESC LIMIT 1",
        )
        .bind(variant.id)
        .first<NonNullable<ProductDetail["pricing"]>>()) ?? null;
  }
  return { product, variantId: variant?.id ?? null, pricing };
}

/** Update editable product fields. Name + status are required (validated at the route). */
export async function updateProduct(
  db: D1Database,
  id: string,
  fields: { name: string; description?: string; status: string },
): Promise<void> {
  await db
    .prepare("UPDATE products SET name = ?, description = ?, status = ? WHERE id = ?")
    .bind(fields.name.trim(), fields.description?.trim() || null, fields.status, id)
    .run();
}

/** Persist a variant's pricing (replaces any prior profile). Amounts in satang. */
export async function setVariantPricing(
  db: D1Database,
  variantId: string,
  itemCostSatang: number,
  targetPriceSatang: number,
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM pricing_profiles WHERE product_variant_id = ?").bind(variantId),
    db
      .prepare(
        "INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, target_price_satang, active_from) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), variantId, itemCostSatang, targetPriceSatang, Date.now()),
  ]);
}

/**
 * Minimal api Worker — a thin HTTP shell over @l-shopee/core + D1. Stock writes route through the
 * StockLedger Durable Object (serialized single writer). Grows into Hono routing, the Shopee adapter,
 * and Queues/Cron. See docs/CLOUDFLARE_ARCHITECTURE.md.
 */
const worker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "kiraoffice-api" });
    }

    if (url.pathname === "/pricing/preview" && request.method === "POST") {
      const line = (await request.json()) as SaleLineInput;
      return json(computeSaleProfit(line));
    }

    if (url.pathname === "/products" && request.method === "GET") {
      return listProducts(env);
    }

    if (url.pathname === "/sales" && request.method === "GET") {
      return listSales(env);
    }

    if (url.pathname === "/sales/export.csv" && request.method === "GET") {
      const csv = salesToCsv(await querySales(env.DB));
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="sales.csv"',
        },
      });
    }

    const barcodeLookup = url.pathname.match(/^\/products\/by-barcode\/(.+)$/);
    if (barcodeLookup && request.method === "GET") {
      const found = await lookupBarcode(env.DB, decodeURIComponent(barcodeLookup[1]!));
      return found ? json(found) : json({ error: "barcode not found" }, 404);
    }

    const productPricing = url.pathname.match(/^\/products\/([^/]+)\/pricing$/);
    if (productPricing && request.method === "PUT") {
      const body = (await request.json()) as {
        itemCostSatang?: number;
        targetPriceSatang?: number;
      };
      const detail = await getProductDetail(env.DB, productPricing[1]!);
      if (!detail?.variantId) return json({ error: "product or variant not found" }, 404);
      await setVariantPricing(
        env.DB,
        detail.variantId,
        body.itemCostSatang ?? 0,
        body.targetPriceSatang ?? 0,
      );
      return json({ ok: true });
    }

    const productById = url.pathname.match(/^\/products\/([^/]+)$/);
    if (productById && request.method === "GET") {
      const detail = await getProductDetail(env.DB, productById[1]!);
      return detail ? json(detail) : json({ error: "not found" }, 404);
    }
    if (productById && request.method === "PATCH") {
      const body = (await request.json()) as {
        name?: string;
        description?: string;
        status?: string;
      };
      if (!body?.name || !body?.status) {
        return json({ error: "name and status are required" }, 400);
      }
      await updateProduct(env.DB, productById[1]!, {
        name: body.name,
        description: body.description,
        status: body.status,
      });
      return json({ ok: true });
    }

    const imageUpload = url.pathname.match(/^\/products\/([^/]+)\/image$/);
    if (imageUpload && request.method === "POST") {
      const bytes = await request.arrayBuffer();
      try {
        const out = await storeProductImage(
          env.DB,
          env.IMAGES,
          imageUpload[1]!,
          bytes,
          request.headers.get("content-type"),
        );
        return json(out, 201);
      } catch (err) {
        return json({ error: (err as Error).message }, 400);
      }
    }

    if (url.pathname.startsWith("/img/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.slice("/img/".length));
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/products" && request.method === "POST") {
      const body = (await request.json()) as Partial<CreateProductInput>;
      if (!body?.productCode || !body?.name) {
        return json({ error: "productCode and name are required" }, 400);
      }
      return json(await createProduct(env.DB, body as CreateProductInput), 201);
    }

    if (url.pathname === "/import/products" && request.method === "POST") {
      const body = (await request.json()) as { csv?: string; mapping?: Record<string, string> };
      return json(await importProducts(env.DB, body.csv ?? "", body.mapping ?? {}));
    }

    if (url.pathname === "/import/shopee-orders" && request.method === "POST") {
      const body = (await request.json()) as { csv?: string; mapping?: Record<string, string> };
      return json(await importShopeeOrders(env.DB, body.csv ?? "", body.mapping ?? {}));
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      const body = (await request.json()) as { sales?: SyncSale[] };
      const ledger = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName("default"));
      return json(await ledger.applySync(body.sales ?? []));
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export default worker;
