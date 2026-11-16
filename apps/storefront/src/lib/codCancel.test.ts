import { describe, expect, it, vi } from "vitest";
import { cancelCodDenied, type CancelLedger, type CodCancelOrder } from "./codCancel";

const ORDER: CodCancelOrder = { id: "o1", paymentStatus: "cod_denied", phone: "0812345678" };

function ledger(answer: Awaited<ReturnType<CancelLedger["cancelOrder"]>>) {
  return { cancelOrder: vi.fn(async () => answer) };
}

/**
 * Bug hunt 15 Nov 2026: the customer's own cancel after a COD refusal only flipped the status, so
 * the stock and the coupon never came back, and the shop's cancel then refused it as already closed.
 * It now goes through the shop's one cancel, inside the stock keeper.
 */
describe("cancelCodDenied", () => {
  it("given a COD-refused order and its phone > then the shop's own cancel runs, stock and coupon back", async () => {
    const l = ledger({ ok: true, restockedUnits: 2 });
    const out = await cancelCodDenied(ORDER, "0812345678", l);
    expect(out.status).toBe(200);
    expect(l.cancelOrder).toHaveBeenCalledWith(
      "o1",
      // "other", not "customer_request": the shop refused COD, so this is no mark on the customer.
      { reason: "other", note: "ลูกค้ายกเลิกหลังปฏิเสธเก็บเงินปลายทาง" },
      null,
    );
  });

  it("given no such order, or another phone > then the same not-found answer", async () => {
    const l = ledger({ ok: true, restockedUnits: 0 });
    expect((await cancelCodDenied(null, "0812345678", l)).status).toBe(404);
    expect((await cancelCodDenied(ORDER, "0899999999", l)).status).toBe(404);
    expect(l.cancelOrder).not.toHaveBeenCalled();
  });

  it("given an order whose COD was not refused > then 409, nothing cancelled", async () => {
    const l = ledger({ ok: true, restockedUnits: 0 });
    const out = await cancelCodDenied({ ...ORDER, paymentStatus: "pending" }, "0812345678", l);
    expect(out.status).toBe(409);
    expect(l.cancelOrder).not.toHaveBeenCalled();
  });

  it("given the stock keeper is out of reach > then 503 — never a half cancel", async () => {
    const out = await cancelCodDenied(ORDER, "0812345678", null);
    expect(out.status).toBe(503);
  });

  it("given the shop's cancel refuses (already closed) > then 409", async () => {
    const l = ledger({
      ok: false,
      code: 409,
      reason: "this order is already cancelled or expired",
    });
    const out = await cancelCodDenied(ORDER, "0812345678", l);
    expect(out.status).toBe(409);
  });
});
