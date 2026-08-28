import { describe, it, expect } from "vitest";
import { OPERATIONAL_STATUSES, operationalStatus } from "@l-shopee/core";
import { orderCardAction } from "./orderCardAction";

describe("orderCardAction", () => {
  it("given a slip waiting to be checked > offers the review as the primary action", () => {
    const a = orderCardAction("new", "verifying");
    expect(a.primary).toBe(true);
    expect(a.label.th).toBe("ตรวจการชำระเงิน");
  });

  it("given money cleared and nothing sent yet > offers the drop-off form", () => {
    const a = orderCardAction("packing", "paid");
    expect(a.primary).toBe(true);
    expect(a.label.th).toBe("บันทึกการส่งของ");
  });

  it("given a COD order awaiting the owner's decision > offers the approval", () => {
    const a = orderCardAction("new", "cod");
    expect(a.primary).toBe(true);
    expect(a.label.th).toBe("อนุมัติปลายทาง");
  });

  it("given a bounced parcel > offers handling it", () => {
    const a = orderCardAction("delivery_failed", "paid");
    expect(a.primary).toBe(true);
    expect(a.label.th).toBe("จัดการพัสดุตีกลับ");
  });

  it("given a claim still open > offers the claim review", () => {
    expect(orderCardAction("claim_pending", "paid").primary).toBe(true);
    expect(orderCardAction("claimed", "paid").primary).toBe(true);
  });

  it("given nothing is waiting on us > the action is a plain View", () => {
    // The whole point of the coloured button is that it means "you". An order in transit, a
    // delivered one, a cancelled one: none of them are anybody's next job, so none of them shout.
    for (const [order, payment] of [
      ["new", "pending"],
      ["shipped", "paid"],
      ["delivered", "paid"],
      ["cancelled", "pending"],
      ["claim_rejected", "paid"],
      ["claimed", "refunded"],
      ["new", "cod_denied"],
    ] as const) {
      const a = orderCardAction(order, payment);
      expect(a.primary, `${order}/${payment}`).toBe(false);
      expect(a.label.th, `${order}/${payment}`).toBe("ดู");
    }
  });

  it("given a status it cannot read > still returns a usable View action", () => {
    // operationalStatus returns null for retired or pre-0069 values. A card with no button at all
    // would be a dead end, so the fallback has to be the safe one rather than nothing.
    const a = orderCardAction("นู่นนี่", null);
    expect(a.label.th).toBe("ดู");
    expect(a.primary).toBe(false);
  });

  it("every operational status has a hint, in both languages", () => {
    // A card whose grey line is blank reads as a rendering bug. The map is keyed by the thirteen,
    // so this fails the moment a fourteenth is added without a line to go with it.
    for (const s of OPERATIONAL_STATUSES) {
      const [order, payment] = SAMPLE[s];
      expect(operationalStatus(order, payment), s).toBe(s);
      const a = orderCardAction(order, payment);
      expect(a.hint.th.length, s).toBeGreaterThan(0);
      expect(a.hint.en.length, s).toBeGreaterThan(0);
    }
  });
});

/** One (order_status, payment_status) pair that derives to each of the thirteen. */
const SAMPLE: Record<string, [string, string | null]> = {
  unpaid: ["new", "pending"],
  verifying: ["new", "verifying"],
  cod_pending: ["new", "cod"],
  cod_reject: ["new", "cod_denied"],
  to_ship: ["packing", "paid"],
  in_transit: ["shipped", "paid"],
  complete: ["delivered", "paid"],
  return: ["delivery_failed", "paid"],
  claim_pending: ["claim_pending", "paid"],
  claimed: ["claimed", "paid"],
  refunded: ["claimed", "refunded"],
  claim_rejected: ["claim_rejected", "paid"],
  fail: ["cancelled", "pending"],
};
