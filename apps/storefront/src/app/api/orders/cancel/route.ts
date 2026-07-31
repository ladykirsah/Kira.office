import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/cancel — a COD-rejected customer cancels instead of switching to transfer.
 * Auth = the (order ref, phone) pair, same rule as /api/orders/lookup (identical 404 either way).
 *
 * order_status → cancelled (so it reads as Cancelled), payment_status stays cod_denied. The
 * cod_denied event stays in history, so the timeline still shows the COD refusal before the cancel.
 * One click, auto — the customer supplies no reason.
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
      .first<{ id: string; paymentStatus: string | null; phone: string }>();
    if (!order || normalizePhone(order.phone) !== phone)
      return Response.json({ error: NOT_FOUND }, { status: 404 });
    // Only a COD-rejected order offers this cancel.
    if (order.paymentStatus !== "cod_denied")
      return Response.json({ error: "คำสั่งซื้อนี้ยกเลิกไม่ได้" }, { status: 409 });

    const now = Date.now();
    await db.batch([
      // Keep payment_status = cod_denied; only the fulfilment axis moves to cancelled.
      db.prepare(`UPDATE sales_orders SET order_status = 'cancelled' WHERE id = ?`).bind(order.id),
      db
        .prepare(
          `INSERT INTO order_status_history
             (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
           VALUES (?, ?, 'cancelled', ?, 'cancelled', NULL, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          order.id,
          order.paymentStatus,
          "ลูกค้ายกเลิกหลังปฏิเสธเก็บเงินปลายทาง",
          now,
        ),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/orders/cancel failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
