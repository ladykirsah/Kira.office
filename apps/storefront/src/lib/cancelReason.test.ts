import { describe, it, expect } from "vitest";
import { cancelStepDetail } from "./cancelReason";

/**
 * The customer sees why the shop cancelled (owner, 30 Oct 2026): the grey line under
 * "ยกเลิกคำสั่งซื้อ" on the order-tracking page.
 */
describe("cancelStepDetail > the cancel step's grey line", () => {
  it("given a reason and a refund still owed > then the reason, then the refund's progress", () => {
    expect(cancelStepDetail("out_of_stock", "รอลูกค้าส่งเลขบัญชี")).toBe(
      "เหตุผล: สินค้าหมด · รอลูกค้าส่งเลขบัญชี",
    );
  });

  it("given a reason and nothing owed > then just the reason", () => {
    expect(cancelStepDetail("unreachable", null)).toBe("เหตุผล: ติดต่อลูกค้าไม่ได้");
  });

  it("given an older cancel with no reason > then only what was there before", () => {
    expect(cancelStepDetail(null, "คืนเงินแล้ว")).toBe("คืนเงินแล้ว");
    expect(cancelStepDetail(null, null)).toBeNull();
  });

  it("given a value the shop never uses > then no raw code reaches the customer", () => {
    expect(cancelStepDetail("made_up", null)).toBeNull();
  });
});
