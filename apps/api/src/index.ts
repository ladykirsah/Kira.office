import { computeSaleProfit, partitionByClientUuid, type SaleLineInput } from "@l-shopee/core";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
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

const json = (data: unknown, status = 200): Response => Response.json(data, { status });

async function listProducts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, product_code AS productCode, name, status FROM products ORDER BY created_at DESC LIMIT 100",
  ).all();
  return json({ products: results });
}

/**
 * Idempotent offline-sale sync. Dedupes by client_uuid (server-applied + in-batch), applies stock as
 * ledger deltas (blocking oversell, surfaced as conflicts), and persists sale + lines + ledger in one
 * D1 batch. The serialized single-writer Durable Object is the next refinement; D1's unique index on
 * client_uuid already guarantees a sale is never double-counted.
 */
async function syncSales(env: Env, sales: SyncSale[]): Promise<Response> {
  if (sales.length === 0) return json({ applied: 0, duplicates: 0, conflicts: [] });

  const uuids = sales.map((s) => s.clientUuid);
  const existingRows = await env.DB.prepare(
    `SELECT client_uuid AS clientUuid FROM onsite_sales WHERE client_uuid IN (${uuids.map(() => "?").join(",")})`,
  )
    .bind(...uuids)
    .all<{ clientUuid: string }>();
  const existing = (existingRows.results ?? []).map((r) => r.clientUuid);
  const { fresh, duplicates } = partitionByClientUuid(existing, sales);
  if (fresh.length === 0) {
    return json({ applied: 0, duplicates: duplicates.length, conflicts: [] });
  }

  const variantIds = [...new Set(fresh.flatMap((s) => s.lines.map((l) => l.productVariantId)))];
  const available: Record<string, number> = {};
  for (const id of variantIds) available[id] = 0;
  if (variantIds.length > 0) {
    const availRows = await env.DB.prepare(
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
        env.DB.prepare(
          `INSERT INTO onsite_sale_lines
           (id, onsite_sale_id, product_variant_id, barcode_value, quantity, unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          saleId,
          line.productVariantId,
          line.barcodeValue ?? null,
          line.quantity,
          line.unitPriceSatang,
          line.discountSatang ?? 0,
          line.taxSatang ?? 0,
          line.unitCostSatang ?? 0,
          0,
        ),
        env.DB.prepare(
          `INSERT INTO stock_ledger_entries
           (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, source_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
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
      env.DB.prepare(
        `INSERT OR IGNORE INTO onsite_sales
         (id, client_uuid, payment_method, sync_status, subtotal_satang, discount_total_satang, tax_total_satang, grand_total_satang, sale_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
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

  if (statements.length > 0) await env.DB.batch(statements);
  return json({ applied, duplicates: duplicates.length, conflicts });
}

/**
 * Minimal api Worker — a thin HTTP shell over @l-shopee/core + D1. Business math lives in core; this
 * layer routes, validates, and persists. Grows into Hono routing, the Shopee adapter, and a
 * serialized stock-ledger Durable Object. See docs/CLOUDFLARE_ARCHITECTURE.md.
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

    if (url.pathname === "/sync" && request.method === "POST") {
      const body = (await request.json()) as { sales?: SyncSale[] };
      return syncSales(env, body.sales ?? []);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export default worker;
