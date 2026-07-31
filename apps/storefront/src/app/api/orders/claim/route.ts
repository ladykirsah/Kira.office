import { getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/claim — a customer files a defect claim on a delivered order. Auth = the
 * (ref, phone) pair, same rule as /api/orders/lookup (identical 404). Multipart: a free-form reason
 * plus evidence — up to 5 photos and 1 video, stored under the claim/ namespace (any-admin readable).
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
    const ref = ((form.get("ref") as string | null) ?? "").trim().toUpperCase();
    const phone = normalizePhone((form.get("phone") as string | null) ?? "");
    const reason = ((form.get("reason") as string | null) ?? "").trim();
    if (!ref || !phone) return Response.json({ error: NOT_FOUND }, { status: 404 });
    if (!reason) return Response.json({ error: "กรุณาอธิบายอาการของสินค้า" }, { status: 400 });

    const order = await env.DB.prepare(
      `SELECT o.id AS id, o.order_status AS orderStatus, o.payment_status AS paymentStatus,
              c.phone AS phone
       FROM sales_orders o
       JOIN storefront_customers c ON c.id = o.storefront_customer_id
       WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
    )
      .bind(ref)
      .first<{
        id: string;
        orderStatus: string | null;
        paymentStatus: string | null;
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
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO order_claims
           (id, sales_order_id, kind, state, reason_note, photo_keys, created_at, updated_at)
         VALUES (?, ?, 'defect', 'requested', ?, ?, ?, ?)`,
      ).bind(claimId, order.id, reason, keys.length ? JSON.stringify(keys) : null, now, now),
      ...(lines ?? []).map((l) =>
        env.DB.prepare(
          `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity)
           VALUES (?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), claimId, l.id, l.quantity),
      ),
      env.DB.prepare(`UPDATE sales_orders SET order_status = 'claim_pending' WHERE id = ?`).bind(
        order.id,
      ),
      env.DB.prepare(
        `INSERT INTO order_status_history
           (id, order_id, order_status, payment_status, event, actor_email, note, created_at)
         VALUES (?, ?, 'claim_pending', ?, 'updated', NULL, ?, ?)`,
      ).bind(crypto.randomUUID(), order.id, order.paymentStatus, "ลูกค้าแจ้งเคลมสินค้า", now),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/orders/claim failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
