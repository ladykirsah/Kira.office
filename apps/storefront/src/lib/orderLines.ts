import type { D1Database } from "@cloudflare/workers-types";

/**
 * The lines of past AirPlus orders, as the customer's own pages read them. Server-side only (pages
 * and route handlers), like lib/db.
 */

/** A line on คำสั่งซื้อของฉัน, with today's price for สั่งอีกครั้ง (never the historical one). */
export interface AccountOrderLine {
  orderId: string;
  variantId: string;
  qty: number;
  productId: string;
  name: string;
  productRef: string;
  /** the size bought, e.g. "3/8 เล็ก" (null for a product without choices) */
  choiceValue: string | null;
  /** the size's own photo, else the product's */
  imageKey: string | null;
  currentPriceSatang: number;
}

/** Every line of the given orders (any order of rows — group by orderId). */
export async function accountOrderLines(
  db: D1Database,
  orderIds: string[],
): Promise<AccountOrderLine[]> {
  if (orderIds.length === 0) return [];
  const rows = await db
    .prepare(
      `SELECT l.sales_order_id AS orderId, l.product_variant_id AS variantId,
              l.quantity AS qty, p.id AS productId, p.name AS name,
              p.product_ref AS productRef, v.option_1_value AS choiceValue,
              COALESCE(v.image_key, p.image_key) AS imageKey,
              COALESCE(pp.online_price_satang, 0) AS currentPriceSatang
       FROM sales_order_lines l
       JOIN product_variants v ON v.id = l.product_variant_id
       JOIN products p ON p.id = v.product_id
       LEFT JOIN pricing_profiles pp ON pp.id =
         (SELECT id FROM pricing_profiles WHERE product_variant_id = v.id
          ORDER BY active_from DESC LIMIT 1)
       WHERE l.sales_order_id IN (${orderIds.map(() => "?").join(",")})`,
    )
    .bind(...orderIds)
    .all<AccountOrderLine>();
  return rows.results ?? [];
}

/** A line on the guest tracking page (ref + phone), at the price it was sold for. */
export interface TrackingOrderLine {
  name: string;
  productRef: string;
  /** the size bought, e.g. "3/8 เล็ก" (null for a product without choices) */
  choiceValue: string | null;
  /** the size's own photo, else the product's */
  imageKey: string | null;
  quantity: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

/** One order's lines, in the order they were added. */
export async function trackingOrderLines(
  db: D1Database,
  orderId: string,
): Promise<TrackingOrderLine[]> {
  const rows = await db
    .prepare(
      `SELECT p.name AS name, p.product_ref AS productRef, v.option_1_value AS choiceValue,
              COALESCE(v.image_key, p.image_key) AS imageKey, l.quantity AS quantity, l.unit_price_satang AS unitPriceSatang,
              l.line_total_satang AS lineTotalSatang
       FROM sales_order_lines l
       JOIN product_variants v ON v.id = l.product_variant_id
       JOIN products p ON p.id = v.product_id
       WHERE l.sales_order_id = ?
       ORDER BY l.created_at`,
    )
    .bind(orderId)
    .all<TrackingOrderLine>();
  return rows.results ?? [];
}
