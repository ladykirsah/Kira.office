import { describe, it, expect } from "vitest";
import {
  canShipOrder,
  OPERATIONAL_STATUSES,
  operationalStatus,
  operationalStatusLabel,
  operationalStatusLabelTh,
  type OperationalStatus,
  operationalStatusPhrase,
} from "./operationalStatus";

/**
 * The owner's own flow, dictated 30 Jul 2026: checkout > pay > delivery > done.
 *
 * This is NOT `sales_orders.order_status`. That column alone cannot answer "what do I do next" —
 * new+pending waits on the customer, new+cod waits on the OWNER to approve COD, and new+verifying
 * means they already paid and are waiting on us. All three have order_status 'new'.
 *
 * Labels are English because Kira.office is English today; the Thai is kept alongside so the
 * bilingual switch the owner plans is a toggle, not a rewrite.
 */
describe("operationalStatus > payment stage", () => {
  it("checkout, nothing paid > unpaid", () => {
    expect(operationalStatus("new", "pending")).toBe("unpaid");
  });

  it("slip uploaded, not yet checked > verifying", () => {
    // The customer HAS paid. Distinct from unpaid because the 48h clock must not touch them.
    expect(operationalStatus("new", "verifying")).toBe("verifying");
  });

  it("payment approved > to_ship", () => {
    expect(operationalStatus("new", "paid")).toBe("to_ship");
    expect(operationalStatus("confirmed", "paid")).toBe("to_ship");
    expect(operationalStatus("packing", "paid")).toBe("to_ship");
  });

  it("COD auto-approved on good credit > to_ship, skipping COD pending entirely", () => {
    // checkout stores cod_confirmed when codApproval(tier) === 'auto', so nothing is pending.
    expect(operationalStatus("new", "cod_confirmed")).toBe("to_ship");
  });

  it("COD needing a human on watch credit > cod_pending", () => {
    expect(operationalStatus("new", "cod")).toBe("cod_pending");
  });

  it("COD denied by the admin > cod_reject, NOT fail", () => {
    // The customer still gets a choice (PromptPay or cancel), so this is a decision point, not death.
    expect(operationalStatus("new", "cod_denied")).toBe("cod_reject");
  });

  it("48h passed unpaid > fail", () => {
    expect(operationalStatus("expired", "expired")).toBe("fail");
  });

  it("cancelled > fail", () => {
    expect(operationalStatus("cancelled", "pending")).toBe("fail");
    expect(operationalStatus("cancelled", "paid")).toBe("fail");
  });

  it("distinguishes all three 'new' orders from one another", () => {
    const three = [
      operationalStatus("new", "pending"),
      operationalStatus("new", "verifying"),
      operationalStatus("new", "cod"),
    ];
    expect(new Set(three).size).toBe(3);
  });
});

describe("operationalStatus > delivery stage", () => {
  it("shipping info entered > in_transit", () => {
    expect(operationalStatus("shipped", "paid")).toBe("in_transit");
    expect(operationalStatus("shipped", "cod_confirmed")).toBe("in_transit");
  });

  it("customer received it > complete", () => {
    expect(operationalStatus("delivered", "paid")).toBe("complete");
  });

  it("COD cash collected on delivery > complete", () => {
    expect(operationalStatus("delivered", "cod_collected")).toBe("complete");
  });

  it("parcel never arrived and came back > return (ตีกลับ)", () => {
    expect(operationalStatus("delivery_failed", "paid")).toBe("return");
  });

  it("a bounced parcel is NOT fail — the money is still live", () => {
    expect(operationalStatus("delivery_failed", "paid")).not.toBe("fail");
  });
});

describe("operationalStatus > claim stage", () => {
  it("customer claims a wrong or defective item > claim_pending", () => {
    expect(operationalStatus("claim_pending", "paid")).toBe("claim_pending");
  });

  it("mechanic approved, exchanging for a new product > claimed", () => {
    expect(operationalStatus("claimed", "paid")).toBe("claimed");
  });

  it("mechanic approved and money returned instead > refunded", () => {
    // Same order status; the money axis decides which of the two resolutions happened.
    expect(operationalStatus("claimed", "refunded")).toBe("refunded");
  });

  it("mechanic found no fault > claim_rejected", () => {
    expect(operationalStatus("claim_rejected", "paid")).toBe("claim_rejected");
  });

  it("a claim outranks the delivery that preceded it", () => {
    // The order WAS delivered; the claim is the newer and more useful truth.
    expect(operationalStatus("claim_pending", "paid")).not.toBe("complete");
  });
});

describe("operationalStatus > precedence", () => {
  it("a refund on a cancelled order is fail, not refunded", () => {
    // `refunded` is reserved for a claim resolution. A cancelled order that got its money back is
    // still just a failed order.
    expect(operationalStatus("cancelled", "refunded")).toBe("fail");
  });

  it("COD denied outranks the order still sitting at new", () => {
    expect(operationalStatus("new", "cod_denied")).toBe("cod_reject");
  });

  it("shipping outranks the payment axis", () => {
    expect(operationalStatus("shipped", "cod_confirmed")).toBe("in_transit");
  });

  it("verifying does not masquerade as paid", () => {
    expect(operationalStatus("new", "verifying")).not.toBe("to_ship");
  });
});

describe("operationalStatus > unknown and legacy data", () => {
  it("null statuses > null rather than a guess", () => {
    expect(operationalStatus(null, null)).toBeNull();
  });

  it("leftover Thai from before migration 0069 > null rather than a mislabel", () => {
    expect(operationalStatus("ใหม่", "รอชำระเงิน")).toBeNull();
  });

  it("the retired `returned` status still reads as a return, not as To ship", () => {
    // `returned` was replaced — a customer send-back is a CLAIM, and ตีกลับ is delivery_failed. It is
    // kept as an alias because without it a stray row falls through to the payment axis and, being
    // paid, would claim to be "To ship" — telling the owner to post a parcel that already came back.
    expect(operationalStatus("returned", "paid")).toBe("return");
  });

  it("an order status nobody recognises, with cleared payment > to_ship", () => {
    // Deliberate: an unknown fulfilment state with the money settled is genuinely ready to send.
    expect(operationalStatus("some_future_state", "paid")).toBe("to_ship");
  });
});

describe("operationalStatus > labels", () => {
  const EXPECTED: [OperationalStatus, string, string][] = [
    ["unpaid", "Unpaid", "ยังไม่ชำระเงิน"],
    ["verifying", "BC pending", "กำลังตรวจสอบ"],
    ["cod_pending", "COD pending", "รอการอนุมัติ"],
    ["cod_reject", "COD reject", "ปฏิเสธเก็บเงินปลายทาง"],
    ["to_ship", "To ship", "เตรียมจัดส่ง"],
    ["in_transit", "In transit", "กำลังจัดส่ง"],
    ["complete", "Complete", "สำเร็จ"],
    ["return", "Return", "ตีกลับ"],
    ["claim_pending", "Claim pending", "รอการอนุมัติจากช่าง"],
    ["claimed", "Claimed", "เคลม"],
    ["refunded", "Refund", "คืนเงิน"],
    ["claim_rejected", "Claim rejected", "ปฏิเสธการเคลม"],
    ["fail", "Fail", "ไม่สำเร็จ"],
  ];

  it("every status has the owner's English and Thai wording", () => {
    for (const [s, en, th] of EXPECTED) {
      expect(operationalStatusLabel(s)).toBe(en);
      expect(operationalStatusLabelTh(s)).toBe(th);
    }
  });

  it("lists all thirteen in flow order — payment, then delivery, then claim", () => {
    expect([...OPERATIONAL_STATUSES]).toEqual(EXPECTED.map(([s]) => s));
  });

  it("no status is missing a label", () => {
    for (const s of OPERATIONAL_STATUSES) {
      expect(operationalStatusLabel(s).length).toBeGreaterThan(0);
      expect(operationalStatusLabelTh(s).length).toBeGreaterThan(0);
    }
  });
});

/**
 * Both languages together, for the bilingual switch (owner, 2026-08-25).
 *
 * The Thai was written into this file long before there was a toggle, precisely so the switch would
 * be wiring rather than a rewrite. This is the guard that keeps it true: a status added later with
 * only an English label is the easy mistake, and it would reach the screen as a blank pill.
 */
describe("operationalStatusPhrase", () => {
  it("given a status > then the owner's own words on both sides", () => {
    expect(operationalStatusPhrase("to_ship")).toEqual({ th: "เตรียมจัดส่ง", en: "To ship" });
    expect(operationalStatusPhrase("claim_pending")).toEqual({
      th: "รอการอนุมัติจากช่าง",
      en: "Claim pending",
    });
  });

  it("says every status in both languages, with none left blank", () => {
    const missing = OPERATIONAL_STATUSES.filter((s) => {
      const p = operationalStatusPhrase(s);
      return !p.th.trim() || !p.en.trim();
    });
    expect(missing).toEqual([]);
  });
});

/**
 * The owner's rule, 27 Aug 2026, stated as the order of events a transfer order must go through:
 * placed → paid → slip attached and approved → shipped. Three of the four were already guarded
 * (a slip cannot be approved without a slip, `paid` cannot be typed in without one, a drop-off
 * cannot be recorded before the money settles). The fourth was not: an order already sitting at
 * `paid` with no slip behind it — a legacy row, or one edited by hand — passed every check and
 * shipped.
 */
describe("canShipOrder", () => {
  it("given a transfer paid WITH its slip > may ship", () => {
    expect(canShipOrder("paid", "slip/o1/abc.jpg")).toBe(true);
  });

  it("given a transfer paid with NO slip > may not ship", () => {
    expect(canShipOrder("paid", null)).toBe(false);
    expect(canShipOrder("paid", "   ")).toBe(false);
  });

  it("given cash on delivery > may ship without any slip", () => {
    // COD is a different flow and never produces one. Requiring a slip here would stop every COD
    // parcel from ever going out, which is the expensive way to get this rule wrong.
    expect(canShipOrder("cod_confirmed", null)).toBe(true);
    expect(canShipOrder("cod_collected", null)).toBe(true);
  });

  it("given money that has not settled > may not ship, slip or no slip", () => {
    for (const s of ["pending", "verifying", "cod", "cod_denied", "refunded", null]) {
      expect(canShipOrder(s, "slip/o1/abc.jpg"), String(s)).toBe(false);
      expect(canShipOrder(s, null), String(s)).toBe(false);
    }
  });
});
