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
  /** Set both to enable Cloudflare Access JWT enforcement (defense-in-depth). Unset = open. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
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

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  // CORS: the admin UI (separate origin: localhost in dev, app.homeseeker.me in prod) calls this API
  // from the browser in its client components. No cookies are used (Access JWT rides a header), so a
  // wildcard origin is safe here.
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, cf-access-jwt-assertion",
  "access-control-max-age": "86400",
};

const json = (data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: SECURITY_HEADERS });

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface AccessClaims {
  email?: string;
  aud?: string | string[];
  exp?: number;
}

/**
 * Verify a Cloudflare Access JWT (Cf-Access-Jwt-Assertion): RS256 signature against the team JWKS,
 * audience and expiry. Throws on any failure. NOTE: the Access application itself (created in the
 * dashboard) is the primary edge gate; this is defense-in-depth and must be confirmed against a real
 * token after the Access app exists.
 */
async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  aud: string,
): Promise<{ email: string | null }> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("malformed token");
  const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(h))) as { kid?: string };
  const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(p))) as AccessClaims;

  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error("bad audience");
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("expired");

  const certs = (await (await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)).json()) as {
    keys: JsonWebKey[] & { kid?: string }[];
  };
  const jwk = certs.keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("unknown signing key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64urlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("bad signature");
  return { email: payload.email ?? null };
}

/**
 * Access gate. Returns the authenticated user (email) on success, a 401 Response on failure, or an
 * open `{ email: null }` when Access is not configured (so the API keeps working until the owner
 * creates the Access app and sets ACCESS_TEAM_DOMAIN + ACCESS_AUD).
 */
export async function requireAccess(
  request: Request,
  env: Env,
): Promise<Response | { email: string | null }> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { email: null };
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return json({ error: "unauthorized" }, 401);
  try {
    return await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
}

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

  async applyAdjustment(adj: StockAdjustment): Promise<AdjustmentResult> {
    return applyAdjustmentToDb(this.env.DB, adj);
  }

  async refundSale(saleId: string): Promise<RefundResult> {
    return refundSaleToDb(this.env.DB, saleId);
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
const MAX_GALLERY_IMAGES = 10;

export interface UploadImageResult {
  key: string;
  url: string;
}

export interface GalleryImage {
  id: string;
  imageKey: string;
  url: string;
  isCover: boolean;
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

function validateImage(bytes: ArrayBuffer, contentType: string | null): string {
  if (!contentType || !ALLOWED_IMAGE_TYPES[contentType]) {
    throw new Error("unsupported image type (use jpeg, png or webp)");
  }
  if (bytes.byteLength === 0) throw new Error("empty image");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large (max 5MB)");
  return ALLOWED_IMAGE_TYPES[contentType];
}

/** Keep products.image_key pointing at the first gallery image (the cover), or null if none. */
async function syncCoverImage(db: D1Database, productId: string): Promise<void> {
  const first = await db
    .prepare(
      "SELECT image_key AS imageKey FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1",
    )
    .bind(productId)
    .first<{ imageKey: string }>();
  await db
    .prepare("UPDATE products SET image_key = ? WHERE id = ?")
    .bind(first?.imageKey ?? null, productId)
    .run();
}

/** Add an image to a product's gallery (up to MAX_GALLERY_IMAGES). The first one becomes the cover. */
export async function storeGalleryImage(
  db: D1Database,
  bucket: R2Bucket,
  productId: string,
  bytes: ArrayBuffer,
  contentType: string | null,
): Promise<GalleryImage> {
  const ext = validateImage(bytes, contentType);
  const countRow = await db
    .prepare("SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?")
    .bind(productId)
    .first<{ n: number }>();
  const count = countRow?.n ?? 0;
  if (count >= MAX_GALLERY_IMAGES) throw new Error(`max ${MAX_GALLERY_IMAGES} images`);

  const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: contentType! } });
  const imageId = crypto.randomUUID();
  const isCover = count === 0;
  await db
    .prepare(
      "INSERT INTO product_images (id, product_id, image_key, sort_order, is_cover, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(imageId, productId, key, count, isCover ? 1 : 0, Date.now())
    .run();
  await syncCoverImage(db, productId);
  return { id: imageId, imageKey: key, url: `/img/${key}`, isCover };
}

/** Remove a gallery image and re-sync the cover. (The R2 object is left in place.) */
export async function deleteGalleryImage(
  db: D1Database,
  productId: string,
  imageId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM product_images WHERE id = ? AND product_id = ?")
    .bind(imageId, productId)
    .run();
  await syncCoverImage(db, productId);
}

export interface StockAdjustment {
  productVariantId: string;
  quantityDelta: number;
  movementType: string;
  reason?: string;
}

export interface AdjustmentResult {
  variantId: string;
  quantityAfter: number;
  applied: boolean;
  reason?: string;
}

/**
 * Apply a manual stock movement (receive / correction / write-off) as a ledger delta. Rejects a zero
 * delta or one that would drive stock negative. Runs through the StockLedger Durable Object so manual
 * adjustments and sales serialize against the same single writer.
 */
export async function applyAdjustmentToDb(
  db: D1Database,
  adj: StockAdjustment,
): Promise<AdjustmentResult> {
  if (!Number.isInteger(adj.quantityDelta) || adj.quantityDelta === 0) {
    return {
      variantId: adj.productVariantId,
      quantityAfter: 0,
      applied: false,
      reason: "quantityDelta must be a non-zero integer",
    };
  }
  const row = await db
    .prepare(
      "SELECT COALESCE(SUM(quantity_delta), 0) AS onHand FROM stock_ledger_entries WHERE product_variant_id = ?",
    )
    .bind(adj.productVariantId)
    .first<{ onHand: number }>();
  const current = Number(row?.onHand ?? 0);
  const after = current + adj.quantityDelta;
  if (after < 0) {
    return {
      variantId: adj.productVariantId,
      quantityAfter: current,
      applied: false,
      reason: `would go negative (on hand ${current})`,
    };
  }
  await db
    .prepare(
      "INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      adj.productVariantId,
      adj.movementType,
      adj.quantityDelta,
      after,
      "manual",
      adj.reason ?? null,
      Date.now(),
    )
    .run();
  return { variantId: adj.productVariantId, quantityAfter: after, applied: true };
}

export interface RefundResult {
  saleId: string;
  applied: boolean;
  restockedLines: number;
  reason?: string;
}

/**
 * Refund/cancel an on-site sale: restock each line (ledger +qty), mark the sale refunded, and write a
 * reversing financial record (negative amount). Idempotent guard against double-refund. Runs through
 * the StockLedger Durable Object so restock serializes with sales.
 */
export async function refundSaleToDb(db: D1Database, saleId: string): Promise<RefundResult> {
  const sale = await db
    .prepare(
      "SELECT id, grand_total_satang AS grandTotalSatang, sale_status AS saleStatus FROM onsite_sales WHERE id = ?",
    )
    .bind(saleId)
    .first<{ id: string; grandTotalSatang: number; saleStatus: string }>();
  if (!sale) return { saleId, applied: false, restockedLines: 0, reason: "sale not found" };
  if (sale.saleStatus === "refunded") {
    return { saleId, applied: false, restockedLines: 0, reason: "already refunded" };
  }

  const linesRes = await db
    .prepare(
      "SELECT product_variant_id AS productVariantId, quantity FROM onsite_sale_lines WHERE onsite_sale_id = ?",
    )
    .bind(saleId)
    .all<{ productVariantId: string | null; quantity: number }>();
  const lines = (linesRes.results ?? []).filter((l) => l.productVariantId);

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (const line of lines) {
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(quantity_delta), 0) AS onHand FROM stock_ledger_entries WHERE product_variant_id = ?",
      )
      .bind(line.productVariantId)
      .first<{ onHand: number }>();
    const after = Number(row?.onHand ?? 0) + line.quantity;
    statements.push(
      db
        .prepare(
          "INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          line.productVariantId,
          "refund",
          line.quantity,
          after,
          "refund",
          saleId,
          now,
        ),
    );
  }
  statements.push(
    db.prepare("UPDATE onsite_sales SET sale_status = 'refunded' WHERE id = ?").bind(saleId),
    db
      .prepare(
        "INSERT INTO financial_records (id, source_type, source_id, record_type, channel, amount_satang, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        "onsite_sale",
        saleId,
        "refund",
        "onsite",
        -sale.grandTotalSatang,
        now,
      ),
  );
  await db.batch(statements);
  return { saleId, applied: true, restockedLines: lines.length };
}

/** On-hand stock per variant (ledger sum) with product info, for the stock screen. */
async function listStock(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT v.id AS variantId, v.sku, p.name AS productName, p.product_code AS productCode,
            COALESCE(SUM(e.quantity_delta), 0) AS onHand
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     LEFT JOIN stock_ledger_entries e ON e.product_variant_id = v.id
     GROUP BY v.id
     ORDER BY p.name
     LIMIT 200`,
  ).all();
  return json({ stock: results });
}

const DEFAULT_TERMS_TEMPLATE = [
  "เงื่อนไขและข้อตกลงสินค้า {{product_name}}",
  "ราคา {{price}} บาท (รวมภาษีมูลค่าเพิ่ม)",
  "รับประกันสินค้า {{warranty_days}} วันนับจากวันที่ได้รับสินค้า",
  "ติดต่อร้าน {{shop_name}}",
].join("\n");

/** Thai T&C template, stored in KV. The admin editor renders it via @l-shopee/core/terms. */
async function getTerms(env: Env): Promise<Response> {
  const template = (await env.KV.get("terms:template")) ?? DEFAULT_TERMS_TEMPLATE;
  return json({ template });
}

/** Products with the default variant's price (offline + online), on-hand stock, and Shopee status. */
async function listProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.product_code AS productCode, p.name, p.status, p.image_key AS imageKey,
            p.shopee_listed AS shopeeListed,
            b.name AS brandName,
            t.name AS typeName,
            u.name AS usageName,
            COALESCE(pp.target_price_satang, 0) AS offlinePriceSatang,
            COALESCE(pp.online_price_satang, 0) AS onlinePriceSatang,
            COALESCE(pp.item_cost_satang, 0) AS itemCostSatang,
            COALESCE(pp.online_commission_bp, 0) AS onlineCommissionBp,
            COALESCE(pp.tax_on_cost, 0) AS taxOnCost,
            COALESCE(
              (SELECT SUM(quantity_delta) FROM stock_ledger_entries WHERE product_variant_id = v.id),
              0
            ) AS onHand
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN product_types t ON t.id = p.type_id
     LEFT JOIN usage_categories u ON u.id = p.usage_id
     LEFT JOIN product_variants v
       ON v.id = (SELECT id FROM product_variants WHERE product_id = p.id ORDER BY created_at LIMIT 1)
     LEFT JOIN pricing_profiles pp ON pp.product_variant_id = v.id
     ORDER BY p.created_at DESC LIMIT 200`,
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

/** Finance summary: on-site sales revenue/VAT/profit + refund totals (all-time). */
async function financeSummary(env: Env): Promise<Response> {
  const sales = await env.DB.prepare(
    "SELECT COUNT(*) AS salesCount, COALESCE(SUM(grand_total_satang),0) AS revenueSatang, COALESCE(SUM(tax_total_satang),0) AS vatSatang FROM onsite_sales WHERE sale_status = 'completed'",
  ).first<{ salesCount: number; revenueSatang: number; vatSatang: number }>();
  const profit = await env.DB.prepare(
    "SELECT COALESCE(SUM(l.gross_profit_satang),0) AS grossProfitSatang FROM onsite_sale_lines l JOIN onsite_sales s ON s.id = l.onsite_sale_id WHERE s.sale_status = 'completed'",
  ).first<{ grossProfitSatang: number }>();
  const refunds = await env.DB.prepare(
    "SELECT COUNT(*) AS refundCount, COALESCE(SUM(-amount_satang),0) AS refundedSatang FROM financial_records WHERE record_type = 'refund'",
  ).first<{ refundCount: number; refundedSatang: number }>();
  return json({
    salesCount: sales?.salesCount ?? 0,
    revenueSatang: sales?.revenueSatang ?? 0,
    vatSatang: sales?.vatSatang ?? 0,
    grossProfitSatang: profit?.grossProfitSatang ?? 0,
    refundCount: refunds?.refundCount ?? 0,
    refundedSatang: refunds?.refundedSatang ?? 0,
  });
}

const BACKUP_TABLES = [
  "products",
  "product_variants",
  "barcodes",
  "pricing_profiles",
  "onsite_sales",
  "onsite_sale_lines",
  "stock_ledger_entries",
  "sales_orders",
  "financial_records",
];

/** Daily logical backup: dump key tables to a dated JSON object in R2. Returns the object key. */
export async function runDailyBackup(env: Env, atMs: number): Promise<string> {
  const dump: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
    dump[table] = results ?? [];
  }
  const key = `backups/${new Date(atMs).toISOString().slice(0, 10)}.json`;
  await env.IMAGES.put(key, JSON.stringify({ exportedAt: atMs, tables: dump }));
  return key;
}

/** Imported sales orders (Shopee CSV bridge), newest first. */
async function listOrders(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, channel, external_order_id AS externalOrderId, order_status AS orderStatus,
            payment_status AS paymentStatus, imported_at AS importedAt
     FROM sales_orders ORDER BY imported_at DESC LIMIT 200`,
  ).all();
  return json({ orders: results });
}

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

/** EAN-13 check digit for the first 12 digits (odd positions ×1, even ×3). Pure + tested. */
export function ean13CheckDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = digits12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Generate an internal EAN-13 barcode (prefix 200 = in-store range) for unlabeled products. */
export function generateInternalBarcode(): string {
  let body = "200";
  const rnd = crypto.getRandomValues(new Uint8Array(9));
  for (let i = 0; i < 9; i++) body += String(rnd[i]! % 10);
  return body + ean13CheckDigit(body);
}

export interface AddBarcodeResult {
  barcodeValue: string;
  generated: boolean;
  variantId: string | null;
}

/** Add a barcode to a product's default variant (generating an internal one if none provided). */
export async function addBarcodeToProduct(
  db: D1Database,
  productId: string,
  providedValue?: string,
): Promise<AddBarcodeResult> {
  const variant = await db
    .prepare(
      "SELECT id, barcode_primary AS barcodePrimary FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(productId)
    .first<{ id: string; barcodePrimary: string | null }>();
  if (!variant) return { barcodeValue: "", generated: false, variantId: null };

  const generated = !providedValue?.trim();
  const barcodeValue = providedValue?.trim() || generateInternalBarcode();
  const now = Date.now();
  const statements = [
    db
      .prepare(
        "INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        variant.id,
        barcodeValue,
        variant.barcodePrimary ? 0 : 1,
        generated ? 1 : 0,
        now,
      ),
  ];
  if (!variant.barcodePrimary) {
    statements.push(
      db
        .prepare("UPDATE product_variants SET barcode_primary = ? WHERE id = ?")
        .bind(barcodeValue, variant.id),
    );
  }
  await db.batch(statements);
  return { barcodeValue, generated, variantId: variant.id };
}

/** Variants with their primary barcode + product info, for the barcode-management screen. */
async function listBarcodes(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT v.id AS variantId, p.id AS productId, p.product_code AS productCode,
            p.name AS productName, v.barcode_primary AS barcode
     FROM product_variants v JOIN products p ON p.id = v.product_id
     ORDER BY p.name LIMIT 500`,
  ).all();
  return json({ barcodes: results });
}

export interface ProductImageRow {
  id: string;
  imageKey: string;
  sortOrder: number;
  isCover: number;
}

export interface Fitment {
  carBrand: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface ProductDetail {
  product: {
    id: string;
    productCode: string;
    name: string;
    description: string | null;
    status: string;
    imageKey: string | null;
    shopeeListed: number;
    shopeeItemId: string | null;
    productRef: string | null;
    category: string | null;
    weightGrams: number;
    brandId: string | null;
    brandName: string | null;
    typeId: string | null;
    typeName: string | null;
    usageId: string | null;
    usageName: string | null;
    updatedAt: number | null;
  };
  variantId: string | null;
  barcode: string | null;
  onHand: number;
  fitments: Fitment[];
  pricing: {
    itemCostSatang: number;
    targetPriceSatang: number; // on-site B2C price
    onlinePriceSatang: number; // online default price
    b2bPriceSatang: number; // on-site B2B price
    onlineCommissionBp: number; // Shopee commission, basis points
    taxOnCost: number; // 1 = add 7% VAT to the cost base
  } | null;
  images: ProductImageRow[];
}

/** Product detail for the edit screen: the product, its default variant + barcode, pricing, gallery. */
export async function getProductDetail(db: D1Database, id: string): Promise<ProductDetail | null> {
  const product = await db
    .prepare(
      `SELECT p.id, p.product_code AS productCode, p.name, p.description, p.status, p.image_key AS imageKey,
              p.shopee_listed AS shopeeListed, p.shopee_item_id AS shopeeItemId, p.product_ref AS productRef,
              p.category, p.weight_grams AS weightGrams,
              p.brand_id AS brandId, b.name AS brandName,
              p.type_id AS typeId, t.name AS typeName,
              p.usage_id AS usageId, u.name AS usageName,
              p.updated_at AS updatedAt
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_types t ON t.id = p.type_id
       LEFT JOIN usage_categories u ON u.id = p.usage_id
       WHERE p.id = ?`,
    )
    .bind(id)
    .first<ProductDetail["product"]>();
  if (!product) return null;
  const variant = await db
    .prepare(
      "SELECT id, barcode_primary AS barcode FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(id)
    .first<{ id: string; barcode: string | null }>();
  let pricing: ProductDetail["pricing"] = null;
  if (variant) {
    pricing =
      (await db
        .prepare(
          "SELECT item_cost_satang AS itemCostSatang, target_price_satang AS targetPriceSatang, online_price_satang AS onlinePriceSatang, b2b_price_satang AS b2bPriceSatang, online_commission_bp AS onlineCommissionBp, tax_on_cost AS taxOnCost FROM pricing_profiles WHERE product_variant_id = ? ORDER BY active_from DESC LIMIT 1",
        )
        .bind(variant.id)
        .first<NonNullable<ProductDetail["pricing"]>>()) ?? null;
  }
  let onHand = 0;
  if (variant) {
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(quantity_delta), 0) AS onHand FROM stock_ledger_entries WHERE product_variant_id = ?",
      )
      .bind(variant.id)
      .first<{ onHand: number }>();
    onHand = Number(row?.onHand ?? 0);
  }
  const { results: images } = await db
    .prepare(
      "SELECT id, image_key AS imageKey, sort_order AS sortOrder, is_cover AS isCover FROM product_images WHERE product_id = ? ORDER BY sort_order",
    )
    .bind(id)
    .all<ProductImageRow>();
  const { results: fitments } = await db
    .prepare(
      "SELECT car_brand AS carBrand, car_model AS carModel, year_from AS yearFrom, year_to AS yearTo FROM product_fitments WHERE product_id = ? ORDER BY sort_order, created_at",
    )
    .bind(id)
    .all<Fitment>();
  return {
    product,
    variantId: variant?.id ?? null,
    barcode: variant?.barcode ?? null,
    onHand,
    fitments,
    pricing,
    images,
  };
}

/** Update editable product fields. Name + status are required (validated at the route). */
export async function updateProduct(
  db: D1Database,
  id: string,
  fields: {
    name: string;
    description?: string;
    status: string;
    shopeeListed?: boolean;
    shopeeItemId?: string;
    productRef?: string;
    category?: string;
    weightGrams?: number;
    brandId?: string | null;
    typeId?: string | null;
    usageId?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      "UPDATE products SET name = ?, description = ?, status = ?, shopee_listed = ?, shopee_item_id = ?, product_ref = ?, category = ?, weight_grams = ?, brand_id = ?, type_id = ?, usage_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(
      fields.name.trim(),
      fields.description?.trim() || null,
      fields.status,
      fields.shopeeListed ? 1 : 0,
      fields.shopeeItemId?.trim() || null,
      fields.productRef?.trim() || null,
      fields.category?.trim() || null,
      Math.max(0, Math.round(fields.weightGrams ?? 0)),
      fields.brandId ?? null,
      fields.typeId ?? null,
      fields.usageId ?? null,
      Date.now(),
      id,
    )
    .run();
}

export interface AttrOption {
  id: string;
  name: string;
}

// Whitelist of attribute kinds → their table. Table names come from this literal map only (never
// from request input), so interpolating them into SQL is safe.
const ATTR_TABLE: Record<string, string> = {
  brand: "brands",
  type: "product_types",
  usage: "usage_categories",
  car_brand: "car_brands",
  car_model: "car_models",
};

/** All managed attribute lists for the product + fitment dropdowns. */
export async function listAttributes(db: D1Database): Promise<{
  brands: AttrOption[];
  types: AttrOption[];
  usages: AttrOption[];
  carBrands: AttrOption[];
  carModels: AttrOption[];
}> {
  const q = (table: string) =>
    db.prepare(`SELECT id, name FROM ${table} ORDER BY sort_order, name`).all<AttrOption>();
  const [brands, types, usages, carBrands, carModels] = await Promise.all([
    q("brands"),
    q("product_types"),
    q("usage_categories"),
    q("car_brands"),
    q("car_models"),
  ]);
  return {
    brands: brands.results ?? [],
    types: types.results ?? [],
    usages: usages.results ?? [],
    carBrands: carBrands.results ?? [],
    carModels: carModels.results ?? [],
  };
}

/** Find an option by name (case-insensitive) or create it. Returns the option. */
export async function addAttribute(
  db: D1Database,
  table: string,
  name: string,
): Promise<AttrOption> {
  const n = name.trim();
  if (!n) throw new Error("name is required");
  const existing = await db
    .prepare(`SELECT id, name FROM ${table} WHERE name = ? COLLATE NOCASE`)
    .bind(n)
    .first<AttrOption>();
  if (existing) return existing;
  const optionId = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO ${table} (id, name, sort_order, created_at) VALUES (?, ?, 0, ?)`)
    .bind(optionId, n, Date.now())
    .run();
  return { id: optionId, name: n };
}

/** Remove an option. Products still referencing it simply show a blank value. */
export async function deleteAttribute(db: D1Database, table: string, id: string): Promise<void> {
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
}

/** Resolve a typed/selected attribute value to an option id (creating it if new); null when empty. */
export async function resolveAttribute(
  db: D1Database,
  table: string,
  name: string | null | undefined,
): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;
  return (await addAttribute(db, table, n)).id;
}

/** A car model plus its service notes, as returned in the fitment tree. */
export interface CarModelNode extends AttrOption, CarModelInfo {}

export interface CarBrandTree {
  id: string;
  name: string;
  models: CarModelNode[];
}

/** Car brands with their models nested — for the fitment dropdowns and the Car fitment settings. */
export async function listCarFitment(db: D1Database): Promise<{ brands: CarBrandTree[] }> {
  const [brands, models] = await Promise.all([
    db.prepare("SELECT id, name FROM car_brands ORDER BY sort_order, name").all<AttrOption>(),
    db
      .prepare(
        "SELECT id, name, car_brand_id AS carBrandId, generation_code AS generationCode, year_from AS yearFrom, year_to AS yearTo, refrigerant, oring_usage AS oringUsage, coolant_liters AS coolantLiters, notes FROM car_models ORDER BY sort_order, name",
      )
      .all<{
        id: string;
        name: string;
        carBrandId: string | null;
        generationCode: string | null;
        yearFrom: number | null;
        yearTo: number | null;
        refrigerant: string | null;
        oringUsage: string | null;
        coolantLiters: string | null;
        notes: string | null;
      }>(),
  ]);
  const byBrand = new Map<string, CarModelNode[]>();
  for (const m of models.results ?? []) {
    if (!m.carBrandId) continue;
    const node: CarModelNode = {
      id: m.id,
      name: m.name,
      generationCode: m.generationCode ?? null,
      yearFrom: m.yearFrom ?? null,
      yearTo: m.yearTo ?? null,
      refrigerant: m.refrigerant ?? null,
      oringUsage: parseOringUsage(m.oringUsage),
      coolantLiters: m.coolantLiters ?? null,
      notes: m.notes ?? null,
    };
    const list = byBrand.get(m.carBrandId);
    if (list) list.push(node);
    else byBrand.set(m.carBrandId, [node]);
  }
  return {
    brands: (brands.results ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      models: byBrand.get(b.id) ?? [],
    })),
  };
}

/**
 * Find-or-create a car model (a generation) under a brand. A model is identified by name + era
 * (year range), so the same name can exist once per generation. When no era is given we match on
 * name alone (era-agnostic) — used to grow the list from typed product fitments without duplicating.
 */
export async function addCarModel(
  db: D1Database,
  brandId: string,
  name: string,
  yearFrom: number | null = null,
  yearTo: number | null = null,
): Promise<AttrOption> {
  const n = name.trim();
  if (!n) throw new Error("name is required");
  const yf = Number.isFinite(yearFrom) ? yearFrom : null;
  const yt = Number.isFinite(yearTo) ? yearTo : null;
  const hasEra = yf != null || yt != null;
  const existing = hasEra
    ? await db
        .prepare(
          "SELECT id, name FROM car_models WHERE car_brand_id = ? AND name = ? COLLATE NOCASE AND year_from IS ? AND year_to IS ?",
        )
        .bind(brandId, n, yf, yt)
        .first<AttrOption>()
    : await db
        .prepare(
          "SELECT id, name FROM car_models WHERE car_brand_id = ? AND name = ? COLLATE NOCASE",
        )
        .bind(brandId, n)
        .first<AttrOption>();
  if (existing) return existing;
  const optionId = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO car_models (id, name, sort_order, car_brand_id, year_from, year_to, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)",
    )
    .bind(optionId, n, brandId, yf, yt, Date.now())
    .run();
  return { id: optionId, name: n };
}

/** How many o-rings of a given size a model uses (basics 3/8"/1/2"/5/8" + special sizes). */
export interface OringEntry {
  size: string;
  qty: number;
}

/** Per-model service notes — a customer-service cheat sheet for a single car model. */
export interface CarModelInfo {
  generationCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  refrigerant: string | null;
  oringUsage: OringEntry[];
  coolantLiters: string | null;
  notes: string | null;
}

/** Parse the stored o-ring JSON into clean {size, qty} rows; tolerant of null/garbage. */
function parseOringUsage(raw: string | null | undefined): OringEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.size === "string" && Number.isFinite(e.qty))
      .map((e) => ({ size: e.size, qty: e.qty }));
  } catch {
    return [];
  }
}

/** Save a car model's service notes. Blank text → null; years coerced to integers (or null). */
export async function updateCarModel(
  db: D1Database,
  id: string,
  info: CarModelInfo,
): Promise<void> {
  const text = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s || null;
  };
  const year = (v: number | null | undefined) => (Number.isFinite(v) ? v : null);
  // Keep only rows with a real size and a finite amount; null the column when none remain.
  const oring = (Array.isArray(info.oringUsage) ? info.oringUsage : [])
    .map((e) => ({ size: (e?.size ?? "").trim(), qty: Number(e?.qty) }))
    .filter((e) => e.size && Number.isFinite(e.qty))
    .map((e) => ({ size: e.size, qty: Math.round(e.qty) }));
  const oringJson = oring.length ? JSON.stringify(oring) : null;
  await db
    .prepare(
      "UPDATE car_models SET generation_code = ?, year_from = ?, year_to = ?, refrigerant = ?, oring_usage = ?, coolant_liters = ?, notes = ? WHERE id = ?",
    )
    .bind(
      text(info.generationCode),
      year(info.yearFrom),
      year(info.yearTo),
      text(info.refrigerant),
      oringJson,
      text(info.coolantLiters),
      text(info.notes),
      id,
    )
    .run();
}

/** Delete a car brand and all of its models. */
export async function deleteCarBrand(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM car_models WHERE car_brand_id = ?").bind(id),
    db.prepare("DELETE FROM car_brands WHERE id = ?").bind(id),
  ]);
}

/**
 * Replace a product's vehicle fitments. Find-or-creates each car brand/model so the managed lists
 * grow from typed values; empty rows are skipped. Years are integers (the second may be null).
 */
export async function setProductFitments(
  db: D1Database,
  productId: string,
  fitments: Fitment[],
): Promise<void> {
  for (const f of fitments) {
    const brandName = f.carBrand?.trim();
    if (!brandName) continue;
    const brandId = (await addAttribute(db, "car_brands", brandName)).id;
    if (f.carModel?.trim()) await addCarModel(db, brandId, f.carModel);
  }
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM product_fitments WHERE product_id = ?").bind(productId),
  ];
  fitments.forEach((f, i) => {
    const brand = f.carBrand?.trim() || null;
    const model = f.carModel?.trim() || null;
    const yearFrom = Number.isFinite(f.yearFrom) ? f.yearFrom : null;
    const yearTo = Number.isFinite(f.yearTo) ? f.yearTo : null;
    if (!brand && !model && yearFrom == null && yearTo == null) return; // skip blank rows
    statements.push(
      db
        .prepare(
          "INSERT INTO product_fitments (id, product_id, car_brand, car_model, year_from, year_to, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(crypto.randomUUID(), productId, brand, model, yearFrom, yearTo, i, now),
    );
  });
  await db.batch(statements);
}

/**
 * Set a variant's primary barcode and make it scannable. Upserts the barcodes table (ignoring a
 * value already taken globally) so POS lookup finds it. Empty value is a no-op.
 */
export async function setVariantBarcode(
  db: D1Database,
  variantId: string,
  value: string,
): Promise<void> {
  const v = value.trim();
  if (!v) return;
  await db.batch([
    db.prepare("UPDATE product_variants SET barcode_primary = ? WHERE id = ?").bind(v, variantId),
    db
      .prepare(
        "INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at) VALUES (?, ?, ?, 1, 0, ?) ON CONFLICT(barcode_value) DO NOTHING",
      )
      .bind(crypto.randomUUID(), variantId, v, Date.now()),
  ]);
}

/** Soft-delete a product (status='archived') — preserves sales history + FKs. */
export async function archiveProduct(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE products SET status = 'archived' WHERE id = ?").bind(id).run();
}

export interface VariantPricing {
  itemCostSatang: number;
  targetPriceSatang: number; // on-site B2C price
  onlinePriceSatang: number; // online default price
  b2bPriceSatang: number; // on-site B2B price
  onlineCommissionBp: number; // Shopee commission, basis points
  taxOnCost: boolean; // add 7% VAT to the cost base
}

/** Persist a variant's pricing (replaces any prior profile). Amounts in satang. */
export async function setVariantPricing(
  db: D1Database,
  variantId: string,
  p: VariantPricing,
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM pricing_profiles WHERE product_variant_id = ?").bind(variantId),
    db
      .prepare(
        "INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, target_price_satang, online_price_satang, b2b_price_satang, online_commission_bp, tax_on_cost, active_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        variantId,
        p.itemCostSatang,
        p.targetPriceSatang,
        p.onlinePriceSatang,
        p.b2bPriceSatang,
        p.onlineCommissionBp,
        p.taxOnCost ? 1 : 0,
        Date.now(),
      ),
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

    // CORS preflight — answer before auth (preflights carry no credentials).
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: SECURITY_HEADERS });
    }

    // Health + image serving stay public; everything else passes the Access gate (a no-op until
    // ACCESS_TEAM_DOMAIN + ACCESS_AUD are set). Mutations are audit-logged with the Access user.
    if (url.pathname === "/health") {
      return json({ ok: true, service: "kiraoffice-api" });
    }

    // Friendly root, so hitting the API host directly isn't a bare 404. The admin UI is a separate
    // app on its own origin (port 3000 in local dev). Public — no data here.
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      const adminUrl =
        url.hostname === "localhost" ? "http://localhost:3000" : "https://app.homeseeker.me";
      const body = `<!doctype html><meta charset="utf-8"><title>kiraoffice API</title>
<body style="font-family:system-ui;max-width:34rem;margin:4rem auto;padding:0 1rem;color:#1f2430;line-height:1.6">
<h1 style="color:#bf3c1d;margin-bottom:.25rem">kiraoffice API</h1>
<p>This is the back-office <strong>API</strong> (health, products, sync…) — not the admin interface.</p>
<p>Open the admin UI at <a href="${adminUrl}" style="color:#bf3c1d">${adminUrl}</a>.</p>
<p style="color:#566071">API health: <a href="/health" style="color:#566071">/health</a></p>`;
      return new Response(body, {
        status: 200,
        headers: { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" },
      });
    }

    const isPublic = url.pathname.startsWith("/img/");
    let userEmail: string | null = null;
    if (!isPublic) {
      const gate = await requireAccess(request, env);
      if (gate instanceof Response) return gate;
      userEmail = gate.email;
    }
    if (request.method !== "GET") {
      console.log(`audit: ${request.method} ${url.pathname} by ${userEmail ?? "anon"}`);
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

    if (url.pathname === "/stock" && request.method === "GET") {
      return listStock(env);
    }

    if (url.pathname === "/terms/template" && request.method === "GET") {
      return getTerms(env);
    }
    if (url.pathname === "/terms/template" && request.method === "PUT") {
      const body = (await request.json()) as { template?: string };
      await env.KV.put("terms:template", body.template ?? "");
      return json({ ok: true });
    }

    if (url.pathname === "/stock/adjust" && request.method === "POST") {
      const body = (await request.json()) as Partial<StockAdjustment>;
      if (!body?.productVariantId || typeof body.quantityDelta !== "number") {
        return json({ error: "productVariantId and quantityDelta are required" }, 400);
      }
      const stub = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName("default"));
      return json(
        await stub.applyAdjustment({
          productVariantId: body.productVariantId,
          quantityDelta: body.quantityDelta,
          movementType: body.movementType ?? "correction",
          reason: body.reason,
        }),
      );
    }

    const refundMatch = url.pathname.match(/^\/sales\/([^/]+)\/refund$/);
    if (refundMatch && request.method === "POST") {
      const stub = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName("default"));
      return json(await stub.refundSale(refundMatch[1]!));
    }

    if (url.pathname === "/sales/export.csv" && request.method === "GET") {
      const csv = salesToCsv(await querySales(env.DB));
      return new Response(csv, {
        headers: {
          ...SECURITY_HEADERS,
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

    if (url.pathname === "/barcodes" && request.method === "GET") {
      return listBarcodes(env);
    }

    // Managed part-attribute lists (brand / car system / part name) for the dropdowns + settings.
    if (url.pathname === "/attributes" && request.method === "GET") {
      return json(await listAttributes(env.DB));
    }
    const attrAdd = url.pathname.match(/^\/attributes\/([^/]+)$/);
    if (attrAdd && request.method === "POST") {
      const table = ATTR_TABLE[attrAdd[1]!];
      if (!table) return json({ error: "unknown attribute kind" }, 404);
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      return json(await addAttribute(env.DB, table, body.name), 201);
    }
    const attrDel = url.pathname.match(/^\/attributes\/([^/]+)\/([^/]+)$/);
    if (attrDel && request.method === "DELETE") {
      const table = ATTR_TABLE[attrDel[1]!];
      if (!table) return json({ error: "unknown attribute kind" }, 404);
      await deleteAttribute(env.DB, table, attrDel[2]!);
      return json({ ok: true });
    }

    // Car fitment taxonomy: brands with nested models (one brand → many models).
    if (url.pathname === "/car-fitment" && request.method === "GET") {
      return json(await listCarFitment(env.DB));
    }
    const cfModelAdd = url.pathname.match(/^\/car-fitment\/brands\/([^/]+)\/models$/);
    if (cfModelAdd && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        yearFrom?: number | null;
        yearTo?: number | null;
      };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      return json(
        await addCarModel(
          env.DB,
          cfModelAdd[1]!,
          body.name,
          body.yearFrom ?? null,
          body.yearTo ?? null,
        ),
        201,
      );
    }
    const cfBrandAdd = url.pathname.match(/^\/car-fitment\/brands$/);
    if (cfBrandAdd && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      if (!body?.name?.trim()) return json({ error: "name is required" }, 400);
      return json(await addAttribute(env.DB, "car_brands", body.name), 201);
    }
    const cfBrandDel = url.pathname.match(/^\/car-fitment\/brands\/([^/]+)$/);
    if (cfBrandDel && request.method === "DELETE") {
      await deleteCarBrand(env.DB, cfBrandDel[1]!);
      return json({ ok: true });
    }
    const cfModelDel = url.pathname.match(/^\/car-fitment\/models\/([^/]+)$/);
    if (cfModelDel && request.method === "DELETE") {
      await deleteAttribute(env.DB, "car_models", cfModelDel[1]!);
      return json({ ok: true });
    }
    const cfModelUpd = url.pathname.match(/^\/car-fitment\/models\/([^/]+)$/);
    if (cfModelUpd && request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as Partial<CarModelInfo>;
      await updateCarModel(env.DB, cfModelUpd[1]!, {
        generationCode: body.generationCode ?? null,
        yearFrom: body.yearFrom ?? null,
        yearTo: body.yearTo ?? null,
        refrigerant: body.refrigerant ?? null,
        oringUsage: Array.isArray(body.oringUsage) ? body.oringUsage : [],
        coolantLiters: body.coolantLiters ?? null,
        notes: body.notes ?? null,
      });
      return json({ ok: true });
    }

    const addBarcode = url.pathname.match(/^\/products\/([^/]+)\/barcode$/);
    if (addBarcode && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { barcodeValue?: string };
      const out = await addBarcodeToProduct(env.DB, addBarcode[1]!, body.barcodeValue);
      return out.variantId ? json(out, 201) : json({ error: "product or variant not found" }, 404);
    }

    const productPricing = url.pathname.match(/^\/products\/([^/]+)\/pricing$/);
    if (productPricing && request.method === "PUT") {
      const body = (await request.json()) as {
        itemCostSatang?: number;
        targetPriceSatang?: number;
        onlinePriceSatang?: number;
        b2bPriceSatang?: number;
        onlineCommissionBp?: number;
        taxOnCost?: boolean;
      };
      const detail = await getProductDetail(env.DB, productPricing[1]!);
      if (!detail?.variantId) return json({ error: "product or variant not found" }, 404);
      await setVariantPricing(env.DB, detail.variantId, {
        itemCostSatang: body.itemCostSatang ?? 0,
        targetPriceSatang: body.targetPriceSatang ?? 0,
        onlinePriceSatang: body.onlinePriceSatang ?? 0,
        b2bPriceSatang: body.b2bPriceSatang ?? 0,
        onlineCommissionBp: body.onlineCommissionBp ?? 0,
        taxOnCost: body.taxOnCost ?? false,
      });
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
        shopeeListed?: boolean;
        shopeeItemId?: string;
        productRef?: string;
        weightGrams?: number;
        barcode?: string;
        brandName?: string;
        usageName?: string;
        typeName?: string;
        fitments?: Fitment[];
      };
      if (!body?.name || !body?.status) {
        return json({ error: "name and status are required" }, 400);
      }
      // Creatable dropdowns: resolve typed/selected names to option ids (creating new ones), and
      // compose a human-readable category (brand · system · part) for the list/search view.
      const brandId = await resolveAttribute(env.DB, "brands", body.brandName);
      const usageId = await resolveAttribute(env.DB, "usage_categories", body.usageName);
      const typeId = await resolveAttribute(env.DB, "product_types", body.typeName);
      const category =
        [body.brandName, body.usageName, body.typeName]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(" · ") || undefined;
      await updateProduct(env.DB, productById[1]!, {
        name: body.name,
        description: body.description,
        status: body.status,
        shopeeListed: body.shopeeListed,
        shopeeItemId: body.shopeeItemId,
        productRef: body.productRef,
        category,
        weightGrams: body.weightGrams,
        brandId,
        typeId,
        usageId,
      });
      if (typeof body.barcode === "string") {
        const variant = await env.DB.prepare(
          "SELECT id FROM product_variants WHERE product_id = ? ORDER BY created_at LIMIT 1",
        )
          .bind(productById[1]!)
          .first<{ id: string }>();
        if (variant) await setVariantBarcode(env.DB, variant.id, body.barcode);
      }
      if (Array.isArray(body.fitments)) {
        await setProductFitments(env.DB, productById[1]!, body.fitments);
      }
      return json({ ok: true });
    }
    if (productById && request.method === "DELETE") {
      await archiveProduct(env.DB, productById[1]!);
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

    // Gallery: add an image (POST) up to 10, or remove one (DELETE /products/:id/images/:imageId).
    const galleryItem = url.pathname.match(/^\/products\/([^/]+)\/images\/([^/]+)$/);
    if (galleryItem && request.method === "DELETE") {
      await deleteGalleryImage(env.DB, galleryItem[1]!, galleryItem[2]!);
      return json({ ok: true });
    }
    const gallery = url.pathname.match(/^\/products\/([^/]+)\/images$/);
    if (gallery && request.method === "POST") {
      const bytes = await request.arrayBuffer();
      try {
        const out = await storeGalleryImage(
          env.DB,
          env.IMAGES,
          gallery[1]!,
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
      if (!obj) return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
      return new Response(obj.body, {
        headers: {
          ...SECURITY_HEADERS,
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

    if (url.pathname === "/orders" && request.method === "GET") {
      return listOrders(env);
    }

    if (url.pathname === "/finance/summary" && request.method === "GET") {
      return financeSummary(env);
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

    return new Response("Not Found", { status: 404, headers: SECURITY_HEADERS });
  },

  // Cron (see wrangler.jsonc triggers.crons): daily D1→R2 backup. The Shopee periodic order pull
  // hooks in here once SHOPEE_* creds are configured (gated on managed-seller API eligibility).
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const key = await runDailyBackup(env, controller.scheduledTime);
    console.log(`backup: wrote ${key}`);
  },
} satisfies ExportedHandler<Env>;

export default worker;
