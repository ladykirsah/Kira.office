import { canCancelOrder, canUploadSlip, returnEligibility } from "@l-shopee/core";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * GET /api/orders/lookup?ref=AP-XXXX&phone=08XXXXXXXX
 *
 * Guest order tracking: no account, no saved links. The pair (order ref, phone) is the
 * credential. SECURITY: a wrong ref and a right-ref-wrong-phone return the IDENTICAL 404 body,
 * so the endpoint never reveals that an order exists for someone else's phone.
 *
 * Also serves the ACTIONS the customer may take (cancel / return), computed by the same core
 * functions the cancel + return endpoints enforce with — so the page can never offer a button that
 * the API would then refuse.
 */
export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  externalOrderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  subtotalSatang: number;
  discountTotalSatang: number;
  feeTotalSatang: number;
  grandTotalSatang: number;
  orderCreatedAt: number | null;
  completedAt: number | null;
  shipTimeMs: number | null;
  carrier: string | null;
  trackingNo: string | null;
  customerName: string | null;
  customerPhone: string | null;
  recipientName: string | null;
  addressPhone: string | null;
  addressLine1: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  paymentMethodLabel: string | null;
  paidAt: number | null;
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

/**
 * COD never writes a `payments` row (no money moves until the courier collects), so its label comes
 * from payment_status instead. Falling back to null lets the UI hide the row rather than lie.
 */
function paymentMethodLabel(row: OrderRow): string | null {
  if (row.paymentStatus === "เก็บเงินปลายทาง") return "เก็บเงินปลายทาง (COD)";
  return row.paymentMethodLabel;
}

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
                o.subtotal_satang AS subtotalSatang, o.discount_total_satang AS discountTotalSatang,
                o.fee_total_satang AS feeTotalSatang, o.grand_total_satang AS grandTotalSatang,
                o.order_created_at AS orderCreatedAt, o.completed_at AS completedAt,
                o.ship_time_ms AS shipTimeMs, o.carrier AS carrier, o.tracking_no AS trackingNo,
                c.name AS customerName, c.phone AS customerPhone,
                a.recipient_name AS recipientName, a.phone AS addressPhone,
                a.address_line1 AS addressLine1, a.subdistrict AS subdistrict,
                a.district AS district, a.province AS province, a.postal_code AS postalCode,
                (SELECT p.method_label FROM payments p
                  WHERE p.sales_order_id = o.id ORDER BY p.created_at LIMIT 1) AS paymentMethodLabel,
                (SELECT p.confirmed_at FROM payments p
                  WHERE p.sales_order_id = o.id ORDER BY p.created_at LIMIT 1) AS paidAt
         FROM sales_orders o
         LEFT JOIN storefront_customers c ON c.id = o.storefront_customer_id
         LEFT JOIN addresses a ON a.id = o.shipping_address_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?
         LIMIT 1`,
      )
      .bind(ref)
      .first<OrderRow>();

    // Identical response for "no such order" and "order belongs to a different phone".
    if (!order || !order.customerPhone || normalizePhone(order.customerPhone) !== phone) {
      return Response.json(NOT_FOUND, { status: 404 });
    }

    const [lines, openReturn] = await Promise.all([
      db
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
        .all<LineRow>(),
      db
        .prepare(
          `SELECT kind, reason, status, decision_note AS decisionNote,
                  created_at AS createdAt, decided_at AS decidedAt
             FROM order_returns WHERE sales_order_id = ?
            ORDER BY created_at DESC LIMIT 1`,
        )
        .bind(order.id)
        .first<{
          kind: string;
          reason: string;
          status: string;
          decisionNote: string | null;
          createdAt: number;
          decidedAt: number | null;
        }>(),
    ]);

    const canReturn = returnEligibility({
      orderStatus: order.orderStatus,
      completedAt: order.completedAt,
      now: Date.now(),
      latestRequestStatus: openReturn?.status ?? null,
    });

    return Response.json({
      ref: order.externalOrderId,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      // Money: every component the customer needs to check the arithmetic themselves.
      subtotalSatang: order.subtotalSatang,
      discountSatang: order.discountTotalSatang,
      shippingSatang: order.feeTotalSatang,
      totalSatang: order.grandTotalSatang,
      createdAt: order.orderCreatedAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      shipTimeMs: order.shipTimeMs,
      carrier: order.carrier,
      trackingNo: order.trackingNo,
      customerName: order.customerName,
      paymentMethod: paymentMethodLabel(order),
      hasPaymentRecord: order.paymentMethodLabel !== null,
      shippingAddress: order.addressLine1
        ? {
            recipientName: order.recipientName,
            phone: order.addressPhone,
            line1: order.addressLine1,
            subdistrict: order.subdistrict,
            district: order.district,
            province: order.province,
            postalCode: order.postalCode,
          }
        : null,
      canCancel: canCancelOrder(order.orderStatus),
      // COD is excluded here, once, rather than the page re-deriving it from a status string.
      canUploadSlip: canUploadSlip({
        paymentStatus: order.paymentStatus,
        hasPaymentRecord: order.paymentMethodLabel !== null,
      }),
      returnEligibility: canReturn,
      returnRequest: openReturn ?? null,
      lines: lines.results ?? [],
    });
  } catch {
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
