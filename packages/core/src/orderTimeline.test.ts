import { describe, it, expect } from "vitest";
import { buildOrderTimeline, type TimelineInput } from "./orderTimeline";

const T0 = 1_800_000_000_000;
const H = 60 * 60 * 1000;

const base: TimelineInput = {
  orderStatus: "ใหม่",
  paymentStatus: "รอชำระเงิน",
  hasPaymentRecord: true,
  createdAt: T0,
  paidAt: null,
  shipTimeMs: null,
  completedAt: null,
  carrier: null,
  trackingNo: null,
  returnRequest: null,
};

/** Compact view of a timeline: "key:tone" per step, so a test reads as the shape it asserts. */
const shape = (i: TimelineInput) => buildOrderTimeline(i).map((s) => `${s.key}:${s.tone}`);
const titles = (i: TimelineInput) => buildOrderTimeline(i).map((s) => s.title);

describe("buildOrderTimeline > prepaid (PromptPay/transfer)", () => {
  it("given a new unpaid order > payment is the CURRENT step, everything after is future", () => {
    expect(shape(base)).toEqual([
      "ordered:done",
      "payment:current",
      "packing:future",
      "transit:future",
      "delivered:future",
    ]);
    expect(titles(base)[1]).toBe("รอชำระเงิน");
  });

  it("given paid and packing > payment done (renamed), packing current", () => {
    const o = { ...base, orderStatus: "เตรียมจัดส่ง", paymentStatus: "ชำระแล้ว", paidAt: T0 + H };
    expect(shape(o)).toEqual([
      "ordered:done",
      "payment:done",
      "packing:current",
      "transit:future",
      "delivered:future",
    ]);
    // The step RENAMES itself once complete — that is the "รอชำระเงิน / ชำระเงิน" pair.
    expect(titles(o)[1]).toBe("ชำระเงิน");
    expect(titles(o)[2]).toBe("เตรียมจัดส่ง");
  });

  it("given handed to the carrier > packing renames to จัดส่งแล้ว and transit becomes current", () => {
    const o = {
      ...base,
      orderStatus: "กำลังจัดส่ง",
      paymentStatus: "ชำระแล้ว",
      paidAt: T0 + H,
      shipTimeMs: T0 + 2 * H,
      carrier: "Kerry Express",
      trackingNo: "KE998877",
    };
    expect(shape(o)).toEqual([
      "ordered:done",
      "payment:done",
      "packing:done",
      "transit:current",
      "delivered:future",
    ]);
    expect(titles(o)[2]).toBe("จัดส่งแล้ว");
    const transit = buildOrderTimeline(o)[3]!;
    expect(transit.detail).toBe("Kerry Express · KE998877");
    expect(buildOrderTimeline(o)[2]!.at).toBe(T0 + 2 * H); // จัดส่งแล้ว carries the ship time
  });

  it("given delivered > every step done, delivery time on the last one", () => {
    const o = {
      ...base,
      orderStatus: "สำเร็จ",
      paymentStatus: "ชำระแล้ว",
      shipTimeMs: T0 + 2 * H,
      completedAt: T0 + 30 * H,
      carrier: "Kerry Express",
      trackingNo: "KE998877",
    };
    expect(shape(o)).toEqual([
      "ordered:done",
      "payment:done",
      "packing:done",
      "transit:done",
      "delivered:done",
    ]);
    expect(buildOrderTimeline(o)[4]!.at).toBe(T0 + 30 * H);
  });

  it("given a step whose timestamp we do not record yet > the step still renders, `at` is null", () => {
    // Owner accepted this: the slot exists now, the shipping system fills it later. It must never
    // invent a time — a wrong timestamp on a delivery is worse than no timestamp.
    const o = { ...base, orderStatus: "เตรียมจัดส่ง", paymentStatus: "ชำระแล้ว", paidAt: null };
    expect(buildOrderTimeline(o)[1]!.at).toBeNull();
    expect(buildOrderTimeline(o)[2]!.at).toBeNull();
  });
});

describe("buildOrderTimeline > COD", () => {
  const cod: TimelineInput = {
    ...base,
    paymentStatus: "เก็บเงินปลายทาง",
    hasPaymentRecord: false,
  };

  it("given COD in transit > payment sits AFTER transit and is NOT yet done (no money has moved)", () => {
    const o = {
      ...cod,
      orderStatus: "กำลังจัดส่ง",
      shipTimeMs: T0 + 2 * H,
      carrier: "Flash Express",
      trackingNo: "TH1234567890",
    };
    expect(shape(o)).toEqual([
      "ordered:done",
      "packing:done",
      "transit:current",
      "payment:future",
      "delivered:future",
    ]);
  });

  it("given a new COD order > payment is never marked done up front (the old page's lie)", () => {
    const marks = buildOrderTimeline(cod);
    const payment = marks.find((s) => s.key === "payment");
    expect(payment?.tone).not.toBe("done");
    expect(marks.map((s) => s.key).indexOf("payment")).toBe(3); // 4th step, before delivered
  });

  it("given COD delivered > payment done, timed at the moment of delivery", () => {
    const o = { ...cod, orderStatus: "สำเร็จ", completedAt: T0 + 30 * H, shipTimeMs: T0 + 2 * H };
    const marks = buildOrderTimeline(o);
    const payment = marks.find((s) => s.key === "payment");
    expect(payment?.tone).toBe("done");
    expect(payment?.at).toBe(T0 + 30 * H); // COD money changes hands AT the door
  });
});

describe("buildOrderTimeline > cancelled", () => {
  it("given cancelled before shipping > ends on ยกเลิก, and never draws a future that cannot happen", () => {
    const o = { ...base, orderStatus: "ยกเลิก" };
    const marks = buildOrderTimeline(o);
    expect(marks.map((s) => s.key)).toEqual(["ordered", "cancelled"]);
    expect(marks[1]!.tone).toBe("bad");
    expect(marks[1]!.title).toBe("ยกเลิกคำสั่งซื้อ");
  });

  it("given cancelled AFTER paying > the payment that really happened is kept", () => {
    const o = { ...base, orderStatus: "ยกเลิก", paymentStatus: "ชำระแล้ว", paidAt: T0 + H };
    expect(buildOrderTimeline(o).map((s) => s.key)).toEqual(["ordered", "payment", "cancelled"]);
  });
});

describe("buildOrderTimeline > refund, continuing from จัดส่งสำเร็จ", () => {
  const delivered: TimelineInput = {
    ...base,
    orderStatus: "สำเร็จ",
    paymentStatus: "ชำระแล้ว",
    shipTimeMs: T0 + 2 * H,
    completedAt: T0 + 30 * H,
    carrier: "Kerry Express",
    trackingNo: "KE998877",
  };

  it("given a request awaiting the mechanic > the shop-inspection step is current", () => {
    const o = {
      ...delivered,
      returnRequest: {
        status: "รอตรวจสอบ",
        createdAt: T0 + 40 * H,
        decidedAt: null,
        decisionNote: null,
      },
    };
    expect(shape(o)).toEqual([
      "ordered:done",
      "payment:done",
      "packing:done",
      "transit:done",
      "delivered:done",
      "refundRequested:done",
      "refundReview:current",
      "refundResult:future",
    ]);
    // The customer must be told to post the part back — the mechanic cannot judge it otherwise.
    expect(buildOrderTimeline(o)[6]!.detail).toContain("ส่งสินค้ากลับ");
  });

  it("given approved but not yet paid out > the result step is current, not done", () => {
    const o = {
      ...delivered,
      returnRequest: {
        status: "อนุมัติ",
        createdAt: T0 + 40 * H,
        decidedAt: T0 + 50 * H,
        decisionNote: null,
      },
    };
    expect(shape(o).slice(-2)).toEqual(["refundReview:done", "refundResult:current"]);
  });

  it("given the refund completed > คืนเงินสำเร็จ with its time", () => {
    const o = {
      ...delivered,
      returnRequest: {
        status: "เสร็จสิ้น",
        createdAt: T0 + 40 * H,
        decidedAt: T0 + 60 * H,
        decisionNote: null,
      },
    };
    const last = buildOrderTimeline(o).at(-1)!;
    expect(last).toMatchObject({ tone: "done", title: "คืนเงินสำเร็จ", at: T0 + 60 * H });
  });

  it("given the refund REJECTED > คืนเงินไม่สำเร็จ, and the shop's reason is shown verbatim", () => {
    const o = {
      ...delivered,
      returnRequest: {
        status: "ปฏิเสธ",
        createdAt: T0 + 40 * H,
        decidedAt: T0 + 60 * H,
        decisionNote: "สินค้ามีร่องรอยการติดตั้งและใช้งานแล้ว",
      },
    };
    const last = buildOrderTimeline(o).at(-1)!;
    expect(last.tone).toBe("bad");
    expect(last.title).toBe("คืนเงินไม่สำเร็จ");
    // A rejection without a reason is the thing customers escalate over — never let it be silent.
    expect(last.detail).toBe("สินค้ามีร่องรอยการติดตั้งและใช้งานแล้ว");
  });

  it("given a rejection with NO reason recorded > still says something, never a blank", () => {
    const o = {
      ...delivered,
      returnRequest: {
        status: "ปฏิเสธ",
        createdAt: T0 + 40 * H,
        decidedAt: T0 + 60 * H,
        decisionNote: null,
      },
    };
    expect(buildOrderTimeline(o).at(-1)!.detail).toBeTruthy();
  });

  it("given a legacy refunded order with no request row > still shows the refund ending", () => {
    const o = { ...delivered, orderStatus: "คืนเงิน", returnRequest: null };
    const keys = buildOrderTimeline(o).map((s) => s.key);
    expect(keys).toContain("refundResult");
    expect(buildOrderTimeline(o).at(-1)!.title).toBe("คืนเงินสำเร็จ");
  });

  it("given a refund on an order whose status no longer says สำเร็จ > delivery is STILL done", () => {
    // order_status holds ONE value, so 'คืนเงิน' overwrites the 'สำเร็จ' that came before it. Refunds
    // begin at delivery (owner's rule), so a refund is proof the parcel arrived. Without this the
    // page drew "จัดส่งสำเร็จ [future]" above "คืนเงินสำเร็จ [done]" — refunding something that,
    // according to the very same timeline, had never been delivered.
    const o = {
      ...delivered,
      orderStatus: "คืนเงิน",
      shipTimeMs: null,
      completedAt: null,
      carrier: null,
      trackingNo: null,
      returnRequest: null,
    };
    const marks = buildOrderTimeline(o);
    expect(marks.filter((s) => s.tone === "future")).toEqual([]);
    expect(marks.find((s) => s.key === "delivered")?.tone).toBe("done");
    expect(marks.find((s) => s.key === "packing")?.title).toBe("จัดส่งแล้ว");
  });
});
