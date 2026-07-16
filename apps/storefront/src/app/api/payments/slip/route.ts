import { looksLikeSlipQr, slipVerificationConfigured, verifySlipWithSlipOk } from "@l-shopee/core";
import { getDb, getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/payments/slip — customer submits a bank-transfer slip's QR payload for their order.
 * Auth = the (order ref, phone) pair, same rule as /api/orders/lookup (identical 404 either way).
 *
 * Two modes:
 *  - SlipOK configured (SLIPOK_API_KEY + SLIPOK_BRANCH_ID secrets on THIS worker): auto-verify
 *    against the real bank transaction → payment confirmed instantly, order marked paid. The
 *    one-slip-one-payment anti-reuse rule mirrors apps/api's confirmPaymentWithSlip (and the
 *    partial UNIQUE index on payments.slip_ref backs it at the DB level).
 *  - Not configured: hold the slip payload for the owner's manual review (status stays pending) —
 *    still one step better than competitors, whose customers must LINE-message a screenshot.
 */

const NOT_FOUND = "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ";

export async function POST(req: Request): Promise<Response> {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const b = (raw ?? {}) as Record<string, unknown>;
    const ref = typeof b.ref === "string" ? b.ref.trim().toUpperCase() : "";
    const phone = normalizePhone(typeof b.phone === "string" ? b.phone : "");
    const qrData = typeof b.qrData === "string" ? b.qrData.trim() : "";
    if (!ref || !phone) return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (!looksLikeSlipQr(qrData))
      return Response.json(
        { error: "อ่านข้อมูลสลิปไม่ได้ กรุณาใช้รูปสลิปที่เห็น QR ชัดเจน" },
        { status: 400 },
      );

    const db = await getDb();
    const order = await db
      .prepare(
        `SELECT o.id AS id, o.grand_total_satang AS grand, c.phone AS phone
         FROM sales_orders o
         JOIN storefront_customers c ON c.id = o.storefront_customer_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
      )
      .bind(ref)
      .first<{ id: string; grand: number; phone: string }>();
    // Identical response for wrong-ref and wrong-phone — never reveal someone else's order.
    if (!order || normalizePhone(order.phone) !== phone)
      return Response.json({ error: NOT_FOUND }, { status: 404 });

    const payment = await db
      .prepare(
        `SELECT id, status, amount_satang AS amountSatang FROM payments
         WHERE sales_order_id = ? LIMIT 1`,
      )
      .bind(order.id)
      .first<{ id: string; status: string; amountSatang: number }>();
    if (!payment)
      return Response.json(
        { error: "คำสั่งซื้อนี้เป็นเก็บเงินปลายทาง ไม่ต้องแนบสลิป" },
        { status: 400 },
      );
    if (payment.status === "confirmed")
      return Response.json({ error: "คำสั่งซื้อนี้ยืนยันการชำระเงินแล้ว" }, { status: 409 });

    const env = await getEnv();
    if (!slipVerificationConfigured(env)) {
      // Manual-review mode: keep the payload for the owner, stay pending.
      await db
        .prepare(`UPDATE payments SET note = ? WHERE id = ?`)
        .bind(JSON.stringify({ slipQr: qrData, submittedAt: Date.now() }), payment.id)
        .run();
      return Response.json({
        status: "received",
        message: "ได้รับสลิปแล้ว ร้านจะตรวจสอบและยืนยันให้โดยเร็วที่สุด",
      });
    }

    const verified = await verifySlipWithSlipOk(env, qrData, payment.amountSatang);
    if (!verified.ok) return Response.json({ error: verified.error }, { status: verified.code });

    // ANTI-CHEAT: one real transfer slip confirms exactly one payment.
    const owner = await db
      .prepare(`SELECT id FROM payments WHERE slip_ref = ?`)
      .bind(verified.ref)
      .first<{ id: string }>();
    if (owner && owner.id !== payment.id)
      return Response.json({ error: "สลิปนี้ถูกใช้ยืนยันการชำระเงินอื่นไปแล้ว" }, { status: 409 });

    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `UPDATE payments SET status = 'confirmed', slip_ref = ?, confirmed_at = ?, verify_note = ?
           WHERE id = ?`,
        )
        .bind(verified.ref, now, verified.note, payment.id),
      db.prepare(`UPDATE sales_orders SET payment_status = 'ชำระแล้ว' WHERE id = ?`).bind(order.id),
    ]);
    return Response.json({ status: "confirmed", message: "ยืนยันการชำระเงินเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("POST /api/payments/slip failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
