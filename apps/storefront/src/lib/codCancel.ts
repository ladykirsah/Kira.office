import { normalizePhone } from "./format";

/**
 * A customer whose cash-on-delivery the shop refused cancels instead of paying by transfer.
 *
 * Bug hunt 15 Nov 2026: this used to flip the order to cancelled by itself, so the stock and the
 * coupon never came back, no cancel time was kept, and the shop's own cancel then refused the order
 * as already closed. Now it goes through the shop's ONE cancel (`cancelOrderInDb`, inside the
 * StockLedger Durable Object): status, stock back, coupon back and the timeline in one step.
 */
export interface CodCancelOrder {
  id: string;
  paymentStatus: string | null;
  phone: string;
}

/** The StockLedger Durable Object's cancel, reached across Workers. */
export interface CancelLedger {
  cancelOrder(
    orderId: string,
    input: { reason: string; note: string | null },
    actorEmail: string | null,
  ): Promise<{ ok: true; restockedUnits: number } | { ok: false; code: number; reason: string }>;
}

const NOT_FOUND = "ไม่พบคำสั่งซื้อ กรุณาตรวจสอบเบอร์โทรและเลขที่คำสั่งซื้อ";
const CANNOT_CANCEL = "คำสั่งซื้อนี้ยกเลิกไม่ได้";
const TRY_AGAIN = "ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

/**
 * "other", not "customer_request": the shop refused the COD, so this cancel is no mark against the
 * customer's credit — as before, when it touched no credit at all.
 */
const COD_CANCEL = { reason: "other", note: "ลูกค้ายกเลิกหลังปฏิเสธเก็บเงินปลายทาง" };

export async function cancelCodDenied(
  order: CodCancelOrder | null,
  phone: string,
  ledger: CancelLedger | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!order || normalizePhone(order.phone) !== phone) {
    return { status: 404, body: { error: NOT_FOUND } };
  }
  // Only a COD-refused order offers this cancel.
  if (order.paymentStatus !== "cod_denied") return { status: 409, body: { error: CANNOT_CANCEL } };
  // Without the stock keeper the stock could not come back, so nothing is cancelled at all.
  if (!ledger) return { status: 503, body: { error: TRY_AGAIN } };
  const out = await ledger.cancelOrder(order.id, COD_CANCEL, null);
  return out.ok
    ? { status: 200, body: { ok: true } }
    : { status: 409, body: { error: CANNOT_CANCEL } };
}
