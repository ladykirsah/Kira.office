import { EXPIRY_MS } from "@l-shopee/core";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/change-payment — a COD-rejected customer switches to bank transfer.
 * Auth = the (order ref, phone) pair, same rule as /api/orders/lookup (identical 404 either way).
 *
 * Moves the order back to `pending` with a FRESH 48h window and creates the `payments` row a COD
 * order never had, so the normal slip-upload flow (SlipUpload → verifying → admin review) works.
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
        `SELECT o.id AS id, o.grand_total_satang AS grand, o.order_status AS orderStatus,
                o.payment_status AS paymentStatus, c.phone AS phone
         FROM sales_orders o
         JOIN storefront_customers c ON c.id = o.storefront_customer_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
      )
      .bind(ref)
      .first<{
        id: string;
        grand: number;
        orderStatus: string | null;
        paymentStatus: string | null;
        phone: string;
      }>();
    if (!order || normalizePhone(order.phone) !== phone)
      return Response.json({ error: NOT_FOUND }, { status: 404 });
    // Only a COD-rejected order offers this switch.
    if (order.paymentStatus !== "cod_denied")
      return Response.json({ error: "คำสั่งซื้อนี้เปลี่ยนวิธีชำระเงินไม่ได้" }, { status: 409 });

    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `UPDATE sales_orders SET payment_status = 'pending', payment_expires_at = ? WHERE id = ?`,
        )
        .bind(now + EXPIRY_MS, order.id),
      db
        .prepare(
          `INSERT INTO payments (id, method_label, promptpay_id, amount_satang, status, created_at, sales_order_id)
           VALUES (?, ?, '', ?, 'pending', ?, ?)`,
        )
        .bind(crypto.randomUUID(), `AirPlus ${ref}`, order.grand, now, order.id),
      db
        .prepare(
          `INSERT INTO order_status_history
             (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
           VALUES (?, ?, ?, 'pending', 'updated', NULL, ?, ?)`,
        )
        .bind(crypto.randomUUID(), order.id, order.orderStatus, "ลูกค้าเปลี่ยนเป็นโอนเงิน", now),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/orders/change-payment failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
