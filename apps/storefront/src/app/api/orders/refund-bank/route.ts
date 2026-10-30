import { classifyRefundAction } from "@l-shopee/core";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/refund-bank — a customer owed money back submits the bank account to refund to:
 * a parcel that bounced (delivery_failed), or an order the shop cancelled after it was paid. Auth = the (order ref, phone) pair, same rule as /api/orders/lookup (an
 * identical 404 either way, so the endpoint never reveals someone else's order).
 *
 * Only an order the back office would refund accepts it (classifyRefundAction — one rule for both
 * sides). The account is stored on the order and is
 * financial PII — the back office shows it to super-admins only.
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
    const bankName = (typeof b.bankName === "string" ? b.bankName : "").trim();
    const accountNo = (typeof b.accountNo === "string" ? b.accountNo : "").trim();
    const accountName = (typeof b.accountName === "string" ? b.accountName : "").trim();
    if (!ref || !phone) return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (!bankName || !accountNo || !accountName)
      return Response.json({ error: "กรุณากรอกข้อมูลบัญชีให้ครบ" }, { status: 400 });

    const db = await getDb();
    const order = await db
      .prepare(
        `SELECT o.id AS id, o.order_status AS orderStatus, o.payment_status AS paymentStatus,
                o.refunded_at AS refundedAt, c.phone AS phone
         FROM sales_orders o
         JOIN storefront_customers c ON c.id = o.storefront_customer_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
      )
      .bind(ref)
      .first<{
        id: string;
        orderStatus: string | null;
        paymentStatus: string | null;
        refundedAt: number | null;
        phone: string;
      }>();
    if (!order || normalizePhone(order.phone) !== phone)
      return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (order.refundedAt != null)
      return Response.json({ error: "คำสั่งซื้อนี้คืนเงินแล้ว" }, { status: 409 });
    const owed = classifyRefundAction({
      orderStatus: order.orderStatus ?? "",
      paymentStatus: order.paymentStatus,
      refundedAt: order.refundedAt,
    });
    if (owed !== "needs_refund")
      return Response.json({ error: "คำสั่งซื้อนี้ไม่สามารถแจ้งบัญชีคืนเงินได้" }, { status: 409 });

    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `UPDATE sales_orders SET refund_bank_name = ?, refund_account_no = ?, refund_account_name = ?
           WHERE id = ?`,
        )
        .bind(bankName, accountNo, accountName, order.id),
      db
        .prepare(
          `INSERT INTO order_status_history
             (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
           VALUES (?, ?, ?, ?, 'updated', NULL, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          order.id,
          order.orderStatus,
          order.paymentStatus,
          "ลูกค้าแจ้งบัญชีรับเงินคืน",
          now,
        ),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/orders/refund-bank failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
