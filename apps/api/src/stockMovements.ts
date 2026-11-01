/** One stock change as GET /stock/movements lists it. */
export interface StockMovement {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string;
  /** The product's code (รหัสสินค้า) and photo, for ประวัติซื้อขาย's rows and detail. */
  productRef: string | null;
  imageKey: string | null;
  movementType: string;
  quantityDelta: number;
  quantityAfter: number;
  /** A sale's price per piece, from its bill or order line; null for every other change. */
  salePriceSatang: number | null;
  createdAt: number;
}

/** A period on ประวัติซื้อขาย's date button, in ms; both ends are included. */
export interface MovementRange {
  from: number;
  to: number;
}

const BAD_RANGE = "from and to must both be dates in ms, from no later than to";

/**
 * `?from=&to=` from the date button: both or neither. Null is no dates (the latest changes); a
 * string is why the request is refused.
 */
export function parseMovementRange(params: URLSearchParams): MovementRange | null | string {
  const from = params.get("from");
  const to = params.get("to");
  if (from == null && to == null) return null;
  if (from == null || to == null) return BAD_RANGE;
  const a = Number(from);
  const b = Number(to);
  const day = (n: number) => Number.isSafeInteger(n) && n >= 0;
  return day(a) && day(b) && a <= b ? { from: a, to: b } : BAD_RANGE;
}

/** With no dates the page shows the latest changes; a period may hold more. */
const LATEST = 100;
const IN_RANGE = 500;

/** The changes, newest first, and how many the list could hold (the page says "ล่าสุด" at it). */
export async function listStockMovements(
  db: D1Database,
  range: MovementRange | null,
): Promise<{ movements: StockMovement[]; limit: number }> {
  const limit = range ? IN_RANGE : LATEST;
  const { results } = await db
    .prepare(
      `SELECT e.id, e.product_variant_id AS variantId, v.sku, p.name AS productName,
              p.product_ref AS productRef, p.image_key AS imageKey,
              e.movement_type AS movementType, e.quantity_delta AS quantityDelta,
              e.quantity_after AS quantityAfter,
              CASE
                WHEN e.movement_type = 'onsite_sale' AND e.source_type = 'onsite_sale' THEN
                (SELECT l.unit_price_satang FROM onsite_sale_lines l
                  WHERE l.onsite_sale_id = e.source_id AND l.product_variant_id = e.product_variant_id
                  ORDER BY l.id LIMIT 1)
                WHEN e.movement_type = 'online_sale' AND e.source_type = 'sales_order' THEN
                (SELECT l.unit_price_satang FROM sales_order_lines l
                  WHERE l.sales_order_id = e.source_id AND l.product_variant_id = e.product_variant_id
                  ORDER BY l.created_at, l.id LIMIT 1)
              END AS salePriceSatang,
              e.created_at AS createdAt
       FROM stock_ledger_entries e
       JOIN product_variants v ON v.id = e.product_variant_id
       JOIN products p ON p.id = v.product_id
       WHERE p.status <> 'archived'${range ? " AND e.created_at BETWEEN ? AND ?" : ""}
       ORDER BY e.created_at DESC
       LIMIT ?`,
    )
    .bind(...(range ? [range.from, range.to] : []), limit)
    .all<StockMovement>();
  return { movements: results, limit };
}
