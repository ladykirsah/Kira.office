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
    // multipart now, not JSON: the slip IMAGE is kept as evidence (owner, 31 Jul), so the request
    // carries the file alongside the QR text the client already decoded. The image is optional — a
    // decode-only client, or a missing R2 binding, still verifies exactly as before.
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
    const ref = str("ref").trim().toUpperCase();
    const phone = normalizePhone(str("phone"));
    const qrData = str("qrData").trim();
    const slipFile = form.get("slip");
    if (!ref || !phone) return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (!looksLikeSlipQr(qrData))
      return Response.json(
        { error: "อ่านข้อมูลสลิปไม่ได้ กรุณาใช้รูปสลิปที่เห็น QR ชัดเจน" },
        { status: 400 },
      );

    const db = await getDb();
    const order = await db
      .prepare(
        // order_status comes along so the timeline entry below can snapshot BOTH axes truthfully
        // rather than guessing what the fulfillment side was at the moment payment landed.
        `SELECT o.id AS id, o.grand_total_satang AS grand, c.phone AS phone,
                o.order_status AS orderStatus
         FROM sales_orders o
         JOIN storefront_customers c ON c.id = o.storefront_customer_id
         WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
      )
      .bind(ref)
      .first<{ id: string; grand: number; phone: string; orderStatus: string | null }>();
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

    // Keep the uploaded slip as back-office evidence. Namespace `slip/` is served super-admin-only
    // via apps/api's private /file route — a bank slip is financial PII, never public. Best-effort:
    // if there is no image or no bucket binding, verification below is unaffected. A dedicated,
    // unconditional UPDATE records the key so a re-upload after `verifying` still refreshes it.
    let slipImageKey: string | null = null;
    if (env.IMAGES && slipFile instanceof File && slipFile.size > 0) {
      slipImageKey = `slip/${order.id}/${crypto.randomUUID()}.jpg`;
      await env.IMAGES.put(slipImageKey, await slipFile.arrayBuffer(), {
        httpMetadata: { contentType: slipFile.type || "image/jpeg" },
      });
    }
    const recordSlipKey = slipImageKey
      ? [
          db
            .prepare(
              `UPDATE sales_orders SET slip_image_key = ? WHERE id = ? AND channel = 'airplus'`,
            )
            .bind(slipImageKey, order.id),
        ]
      : [];

    if (!slipVerificationConfigured(env)) {
      // Manual-review mode (this is what runs today — SlipOK is not configured). Keep the payload
      // for the owner AND move the order to `verifying`.
      //
      // The order move is the important half: without it a customer who paid and uploaded a slip
      // still read payment_status = 'pending', which is indistinguishable from never having paid —
      // so expireUnpaidOrders (which matches new + pending) auto-cancelled them at 48h and docked
      // their credit for it. `verifying` is outside that predicate, so the clock stops the moment
      // the slip arrives.
      const submittedAt = Date.now();
      await db.batch([
        db
          .prepare(`UPDATE payments SET note = ? WHERE id = ?`)
          .bind(JSON.stringify({ slipQr: qrData, submittedAt }), payment.id),
        db
          .prepare(
            // Guarded so a slip re-upload cannot drag an already-confirmed order backwards. Accepts
            // both the stored values a live row can have: 'รอชำระเงิน' before migration 0069, and
            // 'pending' after it.
            `UPDATE sales_orders SET payment_status = 'verifying'
             WHERE id = ? AND channel = 'airplus' AND payment_status IN ('pending', 'รอชำระเงิน')`,
          )
          .bind(order.id),
        db
          .prepare(
            `INSERT INTO order_status_history
               (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
             VALUES (?, ?, ?, 'verifying', 'updated', NULL, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            order.id,
            order.orderStatus,
            "slip submitted, awaiting manual review",
            submittedAt,
          ),
        ...recordSlipKey,
      ]);
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
      db.prepare(`UPDATE sales_orders SET payment_status = 'paid' WHERE id = ?`).bind(order.id),
      // Timeline entry, in the same batch as the status it describes. Like checkout, this route
      // writes to D1 directly and never passes through the API's audit wrapper, so without this a
      // slip-confirmed payment would leave no trace on the order page. Null actor: the customer
      // uploaded the slip; verification was automatic.
      db
        .prepare(
          `INSERT INTO order_status_history
             (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
           VALUES (?, ?, ?, 'paid', 'paid', NULL, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          order.id,
          order.orderStatus,
          `confirmed by slip ${verified.ref}`,
          now,
        ),
      ...recordSlipKey,
    ]);
    return Response.json({ status: "confirmed", message: "ยืนยันการชำระเงินเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("POST /api/payments/slip failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
