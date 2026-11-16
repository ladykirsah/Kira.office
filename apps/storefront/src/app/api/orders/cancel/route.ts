import { getDb, getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { cancelCodDenied, type CancelLedger, type CodCancelOrder } from "@/lib/codCancel";

/**
 * POST /api/orders/cancel — a COD-rejected customer cancels instead of switching to transfer.
 * Auth = the (order ref, phone) pair, same rule as /api/orders/lookup (identical 404 either way).
 *
 * Runs the shop's own cancel inside the StockLedger Durable Object (see lib/codCancel): the order
 * reads Cancelled, its stock and coupon come back, and payment_status stays cod_denied so the
 * timeline still shows the COD refusal before the cancel. One click — the customer gives no reason.
 */
const NOT_FOUND = "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ";

export async function POST(req: Request): Promise<Response> {
  try {
    let b: Record<string, unknown>;
    try {
      b = (await req.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const ref = typeof b.ref === "string" ? b.ref.trim().toUpperCase() : "";
    const phone = normalizePhone(typeof b.phone === "string" ? b.phone : "");
    if (!ref || !phone) return Response.json({ error: NOT_FOUND }, { status: 404 });

    const db = await getDb();
    const order = await db
      .prepare(
        `SELECT o.id AS id, o.payment_status AS paymentStatus, c.phone AS phone
         FROM sales_orders o
         JOIN storefront_customers c ON c.id = o.storefront_customer_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
      )
      .bind(ref)
      .first<CodCancelOrder>();

    const { STOCK_LEDGER } = await getEnv();
    const ledger = STOCK_LEDGER
      ? (STOCK_LEDGER.get(STOCK_LEDGER.idFromName("default")) as unknown as CancelLedger)
      : null;
    if (!ledger) console.error("[orders/cancel] no STOCK_LEDGER binding — cancel refused");

    const out = await cancelCodDenied(order, phone, ledger);
    return Response.json(out.body, { status: out.status });
  } catch (err) {
    console.error("POST /api/orders/cancel failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
