import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * GET /api/orders/lookup?ref=AP-XXXX&phone=08XXXXXXXX
 *
 * Guest order tracking: no account, no saved links. The pair (order ref, phone) is the
 * credential. SECURITY: a wrong ref and a right-ref-wrong-phone return the IDENTICAL 404 body,
 * so the endpoint never reveals that an order exists for someone else's phone.
 */
export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  externalOrderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  grandTotalSatang: number;
  orderCreatedAt: number | null;
  shipTimeMs: number | null;
  carrier: string | null;
  trackingNo: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

interface LineRow {
  name: string;
  productRef: string;
  imageKey: string | null;
  quantity: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

const NOT_FOUND = {
  error: "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ",
};

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const ref = (url.searchParams.get("ref") ?? "").trim();
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    if (!ref || !phone) {
      return Response.json({ error: "กรุณาระบุเลขที่คำสั่งซื้อและเบอร์โทรศัพท์" }, { status: 400 });
    }

    const db = await getDb();
    const order = await db
      .prepare(
        `SELECT o.id AS id, o.external_order_id AS externalOrderId,
                o.order_status AS orderStatus, o.payment_status AS paymentStatus,
                o.grand_total_satang AS grandTotalSatang, o.order_created_at AS orderCreatedAt,
                o.ship_time_ms AS shipTimeMs, o.carrier AS carrier, o.tracking_no AS trackingNo,
                c.name AS customerName, c.phone AS customerPhone
         FROM sales_orders o
         LEFT JOIN storefront_customers c ON c.id = o.storefront_customer_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?
         LIMIT 1`,
      )
      .bind(ref)
      .first<OrderRow>();

    // Identical response for "no such order" and "order belongs to a different phone".
    if (!order || !order.customerPhone || normalizePhone(order.customerPhone) !== phone) {
      return Response.json(NOT_FOUND, { status: 404 });
    }

    const lines = await db
      .prepare(
        `SELECT p.name AS name, p.product_ref AS productRef, p.image_key AS imageKey,
                l.quantity AS quantity, l.unit_price_satang AS unitPriceSatang,
                l.line_total_satang AS lineTotalSatang
         FROM sales_order_lines l
         JOIN product_variants v ON v.id = l.product_variant_id
         JOIN products p ON p.id = v.product_id
         WHERE l.sales_order_id = ?
         ORDER BY l.created_at`,
      )
      .bind(order.id)
      .all<LineRow>();

    return Response.json({
      ref: order.externalOrderId,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalSatang: order.grandTotalSatang,
      createdAt: order.orderCreatedAt,
      shipTimeMs: order.shipTimeMs,
      carrier: order.carrier,
      trackingNo: order.trackingNo,
      customerName: order.customerName,
      lines: lines.results ?? [],
    });
  } catch {
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
