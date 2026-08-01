import { getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/claim — a customer files a defect claim on a delivered order. Auth = the
 * (ref, phone) pair, same rule as /api/orders/lookup (identical 404). Multipart: a free-form reason
 * plus evidence — up to 5 photos and 1 video, stored under the claim/ namespace (any-admin readable).
 *
 * The customer also picks how they want it resolved, right here on the form:
 *  - refund   → they give the bank account to refund to; it lands on the ORDER's refund_* columns
 *               (the same ones the failed-delivery refund uses), so the admin/books reuse that path.
 *  - exchange → they ship to the order's own address, or enter a new one (stored as an addresses row
 *               and referenced by the claim's replacement_address_id).
 *
 * The claim covers the WHOLE order (all its lines) and lands as `requested` → the order moves to
 * claim_pending for a mechanic/super-admin to approve or reject. One active claim at a time.
 */
const NOT_FOUND = "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ";
const CLAIMABLE = new Set(["delivered", "claimed", "claim_pending", "claim_rejected"]);
const MAX_PHOTOS = 5;

export async function POST(req: Request): Promise<Response> {
  try {
    const env = await getEnv();
    const form = await req.formData();
    const str = (k: string) => ((form.get(k) as string | null) ?? "").trim();
    const ref = str("ref").toUpperCase();
    const phone = normalizePhone(str("phone"));
    const reason = str("reason");
    if (!ref || !phone) return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (!reason) return Response.json({ error: "กรุณาอธิบายอาการของสินค้า" }, { status: 400 });

    // How the customer wants it resolved. Validate up front, before any R2 upload, so a bad request
    // never leaves orphaned evidence behind.
    const resolution = str("resolution");
    if (resolution !== "refund" && resolution !== "exchange")
      return Response.json({ error: "กรุณาเลือกวิธีการเคลม" }, { status: 400 });

    const bankName = str("bankName");
    const accountNo = str("accountNo");
    const accountName = str("accountName");
    if (resolution === "refund" && (!bankName || !accountNo || !accountName))
      return Response.json({ error: "กรุณากรอกข้อมูลบัญชีรับเงินคืนให้ครบ" }, { status: 400 });

    // Exchange to a NEW address (else "same" ships to the order's own address, replacement is null).
    const addressChoice = str("addressChoice");
    const newAddr = {
      recipientName: str("recipientName"),
      phone: normalizePhone(str("addressPhone")),
      addressLine1: str("addressLine1"),
      subdistrict: str("subdistrict"),
      district: str("district"),
      province: str("province"),
      postalCode: str("postalCode"),
    };
    const wantsNewAddress = resolution === "exchange" && addressChoice === "new";
    if (wantsNewAddress && Object.values(newAddr).some((v) => !v))
      return Response.json({ error: "กรุณากรอกที่อยู่จัดส่งใหม่ให้ครบ" }, { status: 400 });

    const order = await env.DB.prepare(
      `SELECT o.id AS id, o.order_status AS orderStatus, o.payment_status AS paymentStatus,
              o.storefront_customer_id AS storefrontCustomerId, c.phone AS phone
       FROM sales_orders o
       JOIN storefront_customers c ON c.id = o.storefront_customer_id
       WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
    )
      .bind(ref)
      .first<{
        id: string;
        orderStatus: string | null;
        paymentStatus: string | null;
        storefrontCustomerId: string;
        phone: string;
      }>();
    if (!order || normalizePhone(order.phone) !== phone)
      return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (!order.orderStatus || !CLAIMABLE.has(order.orderStatus))
      return Response.json({ error: "คำสั่งซื้อนี้ยังเคลมไม่ได้" }, { status: 409 });

    // One active claim at a time — cancelled (rejected) and done are the terminal states.
    const active = await env.DB.prepare(
      `SELECT state FROM order_claims
       WHERE sales_order_id = ? AND state NOT IN ('cancelled','done')
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(order.id)
      .first<{ state: string }>();
    if (active)
      return Response.json({ error: "มีการเคลมที่กำลังดำเนินการอยู่แล้ว" }, { status: 409 });

    // Evidence: up to 5 photos + up to 1 video. Best-effort — a claim with no media still stands.
    const keys: string[] = [];
    if (env.IMAGES) {
      const photos = form
        .getAll("photos")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .slice(0, MAX_PHOTOS);
      for (const p of photos) {
        const key = `claim/${order.id}/${crypto.randomUUID()}.jpg`;
        await env.IMAGES.put(key, await p.arrayBuffer(), {
          httpMetadata: { contentType: p.type || "image/jpeg" },
        });
        keys.push(key);
      }
      const video = form.get("video");
      if (video instanceof File && video.size > 0) {
        const ext = (video.type.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "") || "mp4";
        const key = `claim/${order.id}/${crypto.randomUUID()}.${ext}`;
        await env.IMAGES.put(key, await video.arrayBuffer(), {
          httpMetadata: { contentType: video.type || "video/mp4" },
        });
        keys.push(key);
      }
    }

    const { results: lines } = await env.DB.prepare(
      `SELECT id, quantity FROM sales_order_lines WHERE sales_order_id = ?`,
    )
      .bind(order.id)
      .all<{ id: string; quantity: number }>();

    const now = Date.now();
    const claimId = crypto.randomUUID();
    const replacementAddressId = wantsNewAddress ? crypto.randomUUID() : null;

    const batch = [];
    // The new replacement address must be inserted BEFORE the claim that references it (FK order).
    if (wantsNewAddress) {
      batch.push(
        env.DB.prepare(
          `INSERT INTO addresses
             (id, storefront_customer_id, recipient_name, phone, address_line1, subdistrict,
              district, province, postal_code, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          replacementAddressId,
          order.storefrontCustomerId,
          newAddr.recipientName,
          newAddr.phone,
          newAddr.addressLine1,
          newAddr.subdistrict,
          newAddr.district,
          newAddr.province,
          newAddr.postalCode,
          now,
        ),
      );
    }
    batch.push(
      env.DB.prepare(
        `INSERT INTO order_claims
           (id, sales_order_id, kind, state, resolution, replacement_address_id, reason_note,
            photo_keys, created_at, updated_at)
         VALUES (?, ?, 'defect', 'requested', ?, ?, ?, ?, ?, ?)`,
      ).bind(
        claimId,
        order.id,
        resolution,
        replacementAddressId,
        reason,
        keys.length ? JSON.stringify(keys) : null,
        now,
        now,
      ),
      ...(lines ?? []).map((l) =>
        env.DB.prepare(
          `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity)
           VALUES (?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), claimId, l.id, l.quantity),
      ),
    );
    // A refund choice pre-fills the order's refund bank columns — the same ones the failed-delivery
    // refund reads — so the super-admin sees the payout account when they resolve the claim.
    if (resolution === "refund") {
      batch.push(
        env.DB.prepare(
          `UPDATE sales_orders SET refund_bank_name = ?, refund_account_no = ?,
                 refund_account_name = ? WHERE id = ?`,
        ).bind(bankName, accountNo, accountName, order.id),
      );
    }
    batch.push(
      env.DB.prepare(`UPDATE sales_orders SET order_status = 'claim_pending' WHERE id = ?`).bind(
        order.id,
      ),
      env.DB.prepare(
        `INSERT INTO order_status_history
           (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
         VALUES (?, ?, 'claim_pending', ?, 'updated', NULL, ?, ?)`,
      ).bind(crypto.randomUUID(), order.id, order.paymentStatus, "ลูกค้าแจ้งเคลมสินค้า", now),
    );
    await env.DB.batch(batch);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/orders/claim failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
