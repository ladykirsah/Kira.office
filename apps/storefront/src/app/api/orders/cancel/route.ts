import { canCancelOrder } from "@l-shopee/core";
import { getDb, getEnv } from "@/lib/db";
import { guardMutation } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/cancel  { ref, phone, reason? }
 *
 * Customer-initiated cancel. Owner's rule (2026-07-16): allowed until the parcel leaves the shop
 * (ใหม่ / เตรียมจัดส่ง) — enforced by canCancelOrder in @l-shopee/core, the SAME function the
 * lookup endpoint uses to decide whether to show the button.
 *
 * Auth is the guest-tracking credential (ref + phone), identical to the lookup endpoint, and it
 * returns the same opaque 404 so this route can't be used to probe which orders exist.
 *
 * RACE SAFETY — the reason this is one guarded UPDATE and not a read-then-write:
 * the shop may be pressing "จัดส่งแล้ว" in the admin at the same moment the customer taps ยกเลิก.
 * `WHERE order_status IN ('ใหม่','เตรียมจัดส่ง')` makes D1 arbitrate: exactly one of the two wins.
 * Stock is restored ONLY when meta.changes === 1, so a losing/duplicate cancel can never
 * double-restock — which is also why the restore does not need its own idempotency key.
 */
export const dynamic = "force-dynamic";

const NOT_FOUND = { error: "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ" };

interface CancelBody {
  ref?: unknown;
  phone?: unknown;
  reason?: unknown;
}

/**
 * Put the sold units back on the shelf through the StockLedger DO — the single serialized writer,
 * so this can't race the shop's own adjustments. Best-effort + loud, mirroring checkout's deduction:
 * the order is already cancelled for the customer, and failing the request now would leave them
 * staring at an order that IS cancelled but says it isn't. A stuck count is the owner's to correct;
 * a lying page is not recoverable.
 */
async function restoreStockBestEffort(
  orderRef: string,
  lines: { variantId: string; qty: number }[],
): Promise<void> {
  try {
    const { STOCK_LEDGER } = await getEnv();
    if (!STOCK_LEDGER) {
      console.warn(`[cancel] stock restore skipped — no STOCK_LEDGER binding (local dev?)`);
      return;
    }
    const stub = STOCK_LEDGER.get(STOCK_LEDGER.idFromName("default")) as unknown as {
      applyAdjustment(adj: {
        productVariantId: string;
        quantityDelta: number;
        movementType: string;
        reason?: string;
      }): Promise<{ applied: boolean; quantityAfter: number }>;
    };
    for (const line of lines) {
      const res = await stub.applyAdjustment({
        productVariantId: line.variantId,
        quantityDelta: line.qty, // positive = back on the shelf
        movementType: "refund_return",
        reason: `ลูกค้ายกเลิกคำสั่งซื้อ ${orderRef}`,
      });
      if (!res.applied) {
        console.error(`[cancel] stock restore REJECTED for ${line.variantId} on ${orderRef}`);
      }
    }
  } catch (err) {
    console.error(`[cancel] stock restore failed for order ${orderRef}`, err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;

    let body: CancelBody;
    try {
      body = (await req.json()) as CancelBody;
    } catch {
      return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const ref = typeof body.ref === "string" ? body.ref.trim() : "";
    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (!ref || !phone) {
      return Response.json({ error: "กรุณาระบุเลขที่คำสั่งซื้อและเบอร์โทรศัพท์" }, { status: 400 });
    }

    const db = await getDb();
    const order = await db
      .prepare(
        `SELECT o.id AS id, o.order_status AS orderStatus, c.phone AS customerPhone
           FROM sales_orders o
           LEFT JOIN storefront_customers c ON c.id = o.storefront_customer_id
          WHERE o.channel = 'airplus' AND o.external_order_id = ?
          LIMIT 1`,
      )
      .bind(ref)
      .first<{ id: string; orderStatus: string | null; customerPhone: string | null }>();

    if (!order || !order.customerPhone || normalizePhone(order.customerPhone) !== phone) {
      return Response.json(NOT_FOUND, { status: 404 });
    }

    // Friendly, specific refusal BEFORE attempting the write, so an ineligible order gets a real
    // sentence instead of a generic failure. The guarded UPDATE below is still the authority.
    if (!canCancelOrder(order.orderStatus)) {
      return Response.json(
        {
          error:
            order.orderStatus === "ยกเลิก"
              ? "คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว"
              : "คำสั่งซื้อนี้จัดส่งแล้ว จึงยกเลิกไม่ได้ — หากต้องการส่งคืน กรุณาใช้ปุ่ม “คืนสินค้า”",
        },
        { status: 409 },
      );
    }

    // Read the lines BEFORE cancelling: after the UPDATE they are unchanged, but reading first keeps
    // the restore list stable even if a later query were to filter on status.
    const lines = await db
      .prepare(
        `SELECT product_variant_id AS variantId, quantity AS qty
           FROM sales_order_lines WHERE sales_order_id = ?`,
      )
      .bind(order.id)
      .all<{ variantId: string; qty: number }>();

    const note = reason ? `ลูกค้ายกเลิก: ${reason}` : "ลูกค้ายกเลิกผ่านหน้าเว็บ";
    const res = await db
      .prepare(
        `UPDATE sales_orders
            SET order_status = 'ยกเลิก'
          WHERE id = ? AND order_status IN ('ใหม่', 'เตรียมจัดส่ง')`,
      )
      .bind(order.id)
      .run();

    // 0 changes = the shop shipped it (or another tab cancelled) between our read and this write.
    if (!res.meta || res.meta.changes !== 1) {
      return Response.json(
        { error: "คำสั่งซื้อนี้เพิ่งถูกอัปเดต จึงยกเลิกไม่ได้ กรุณารีเฟรชหน้านี้" },
        { status: 409 },
      );
    }

    await restoreStockBestEffort(ref, lines.results ?? []);
    console.info(`[cancel] order ${ref} cancelled by customer — ${note}`);

    return Response.json({ ok: true, orderStatus: "ยกเลิก" });
  } catch {
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
