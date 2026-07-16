import { returnEligibility } from "@l-shopee/core";
import { getDb } from "@/lib/db";
import { guardMutation } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/returns  { ref, phone, kind: 'return'|'claim', reason, note? }
 *
 * Opens a คืนสินค้า / เคลม request. Owner's rule (2026-07-16): allowed for 7 days after สำเร็จ,
 * and EVERY request is decided by the shop's mechanic — so this endpoint deliberately changes
 * nothing except inserting the request. No stock moves. No money moves. No status flips on the
 * order itself. That is the whole safety story: the worst a malicious caller achieves is a row the
 * mechanic rejects.
 *
 * Auth + the opaque 404 match the lookup endpoint (ref + phone is the guest credential).
 */
export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ" };

/** Fixed Thai reasons; free text goes to `note` so the list stays reportable. */
const REASONS = [
  "สินค้าไม่ตรงรุ่นรถ",
  "สินค้าชำรุด/เสียหาย",
  "ได้รับสินค้าผิดรุ่น",
  "สินค้าใช้งานไม่ได้",
  "เปลี่ยนใจ",
  "อื่น ๆ",
] as const;

const REFUSAL: Record<string, string> = {
  "not-completed": "คำสั่งซื้อนี้ยังไม่สำเร็จ จึงยังคืนสินค้าไม่ได้",
  "window-expired": "เลยกำหนด 7 วันหลังได้รับสินค้าแล้ว กรุณาติดต่อร้านผ่าน LINE",
  "already-requested": "คำขอของคุณอยู่ระหว่างตรวจสอบแล้ว ทีมช่างจะติดต่อกลับโดยเร็ว",
  // Not a dead end, a redirect: the automated route is finished, a human takes over from here.
  rejected: "คำขอก่อนหน้าไม่ผ่านการตรวจสอบจากทีมช่าง กรุณาติดต่อร้านทาง LINE",
};

interface ReturnBody {
  ref?: unknown;
  phone?: unknown;
  kind?: unknown;
  reason?: unknown;
  note?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;

    let body: ReturnBody;
    try {
      body = (await req.json()) as ReturnBody;
    } catch {
      return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const ref = typeof body.ref === "string" ? body.ref.trim() : "";
    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const kind = body.kind === "claim" ? "claim" : body.kind === "return" ? "return" : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    if (!ref || !phone) {
      return Response.json({ error: "กรุณาระบุเลขที่คำสั่งซื้อและเบอร์โทรศัพท์" }, { status: 400 });
    }
    if (!kind) return Response.json({ error: "กรุณาเลือกประเภทคำขอ" }, { status: 400 });
    if (!(REASONS as readonly string[]).includes(reason)) {
      return Response.json({ error: "กรุณาเลือกเหตุผล" }, { status: 400 });
    }

    const db = await getDb();
    const order = await db
      .prepare(
        `SELECT o.id AS id, o.order_status AS orderStatus, o.completed_at AS completedAt,
                c.phone AS customerPhone
           FROM sales_orders o
           LEFT JOIN storefront_customers c ON c.id = o.storefront_customer_id
          WHERE o.channel = 'airplus' AND o.external_order_id = ?
          LIMIT 1`,
      )
      .bind(ref)
      .first<{
        id: string;
        orderStatus: string | null;
        completedAt: number | null;
        customerPhone: string | null;
      }>();

    if (!order || !order.customerPhone || normalizePhone(order.customerPhone) !== phone) {
      return Response.json(NOT_FOUND, { status: 404 });
    }

    const latest = await db
      .prepare(
        `SELECT status FROM order_returns WHERE sales_order_id = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(order.id)
      .first<{ status: string }>();

    const eligible = returnEligibility({
      orderStatus: order.orderStatus,
      completedAt: order.completedAt,
      now: Date.now(),
      latestRequestStatus: latest?.status ?? null,
    });
    if (!eligible.allowed) {
      return Response.json(
        { error: REFUSAL[eligible.reason] ?? "ขณะนี้ยังส่งคำขอไม่ได้" },
        { status: 409 },
      );
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO order_returns (id, sales_order_id, kind, reason, note, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'รอตรวจสอบ', ?)`,
      )
      .bind(id, order.id, kind, reason, note || null, Date.now())
      .run();

    // The mechanic works from LINE, not a dashboard — the client opens the OA with this text so the
    // request reaches a human immediately rather than waiting for an admin screen to exist.
    console.info(`[returns] ${kind} requested on ${ref}: ${reason}`);
    return Response.json({ ok: true, id, status: "รอตรวจสอบ" });
  } catch {
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
