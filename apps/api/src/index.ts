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

async function listProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, product_code AS productCode, name, status FROM products ORDER BY created_at DESC LIMIT 100",
  ).all();
  return json({ products: results });
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
