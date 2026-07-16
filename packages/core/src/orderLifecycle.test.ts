import { describe, it, expect } from "vitest";
import {
  canCancelOrder,
  canUploadSlip,
  isCodOrder,
  orderStatusBadge,
  returnEligibility,
  RETURN_WINDOW_DAYS,
} from "./orderLifecycle";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("canCancelOrder", () => {
  it("given ใหม่ > true (nothing has been packed yet)", () => {
    expect(canCancelOrder("ใหม่")).toBe(true);
  });

  it("given เตรียมจัดส่ง > true (still in the shop, owner rule: cancel until it ships)", () => {
    expect(canCancelOrder("เตรียมจัดส่ง")).toBe(true);
  });

  it("given กำลังจัดส่ง > false (with the carrier — คืนสินค้า is the only route)", () => {
    expect(canCancelOrder("กำลังจัดส่ง")).toBe(false);
  });

  it("given สำเร็จ > false", () => {
    expect(canCancelOrder("สำเร็จ")).toBe(false);
  });

  it("given ยกเลิก > false (no double cancel)", () => {
    expect(canCancelOrder("ยกเลิก")).toBe(false);
  });

  it("given คืนเงิน > false", () => {
    expect(canCancelOrder("คืนเงิน")).toBe(false);
  });

  it("given an unknown or missing status > false (fail closed — never guess about stock)", () => {
    expect(canCancelOrder(null)).toBe(false);
    expect(canCancelOrder("")).toBe(false);
    expect(canCancelOrder("delivered")).toBe(false);
  });
});

describe("orderStatusBadge", () => {
  it("given เตรียมจัดส่ง > its own PREPARING badge, never the shipping one", () => {
    // The bug this test exists for: "เตรียมจัดส่ง" CONTAINS the substring "จัดส่ง", so any
    // includes("จัดส่ง") test silently swallows the preparing state into "in transit".
    expect(orderStatusBadge({ orderStatus: "เตรียมจัดส่ง", hasTracking: false })).toEqual({
      tone: "warn",
      label: "เตรียมจัดส่ง",
    });
  });

  it("given เตรียมจัดส่ง WITH tracking already attached > still preparing (status wins)", () => {
    expect(orderStatusBadge({ orderStatus: "เตรียมจัดส่ง", hasTracking: true }).label).toBe(
      "เตรียมจัดส่ง",
    );
  });

  it("given กำลังจัดส่ง > the in-transit badge, worded for the customer", () => {
    expect(orderStatusBadge({ orderStatus: "กำลังจัดส่ง", hasTracking: true })).toEqual({
      tone: "ship",
      label: "อยู่ระหว่างการจัดส่ง",
    });
  });

  it("given tracking but a vague status > in transit (a tracking number means it left)", () => {
    expect(orderStatusBadge({ orderStatus: "", hasTracking: true }).label).toBe(
      "อยู่ระหว่างการจัดส่ง",
    );
  });

  it("given สำเร็จ > done, even though 'จัดส่งสำเร็จ' also contains จัดส่ง", () => {
    expect(orderStatusBadge({ orderStatus: "สำเร็จ", hasTracking: true }).tone).toBe("good");
    expect(orderStatusBadge({ orderStatus: "จัดส่งสำเร็จ", hasTracking: true }).tone).toBe("good");
  });

  it("given ยกเลิก or คืนเงิน > bad", () => {
    expect(orderStatusBadge({ orderStatus: "ยกเลิก", hasTracking: false }).tone).toBe("bad");
    expect(orderStatusBadge({ orderStatus: "คืนเงิน", hasTracking: false }).tone).toBe("bad");
  });

  it("given a new order > pending", () => {
    expect(orderStatusBadge({ orderStatus: "ใหม่", hasTracking: false })).toEqual({
      tone: "soft",
      label: "รอดำเนินการ",
    });
  });
});

describe("isCodOrder", () => {
  it("given no payment record > true (checkout only writes one for prepaid methods)", () => {
    expect(isCodOrder({ paymentStatus: "ใหม่", hasPaymentRecord: false })).toBe(true);
  });

  it("given the COD payment status > true, even if a stray payment record exists", () => {
    expect(isCodOrder({ paymentStatus: "เก็บเงินปลายทาง", hasPaymentRecord: true })).toBe(true);
  });

  it("given a prepaid order awaiting a transfer > false", () => {
    expect(isCodOrder({ paymentStatus: "รอชำระเงิน", hasPaymentRecord: true })).toBe(false);
  });
});

describe("canUploadSlip", () => {
  it("given a COD order > false — this is the whole point: COD never needs a slip", () => {
    expect(canUploadSlip({ paymentStatus: "เก็บเงินปลายทาง", hasPaymentRecord: false })).toBe(
      false,
    );
  });

  it("given a COD order whose status was flipped to รอชำระเงิน by the shop > STILL false", () => {
    // The admin can overwrite payment_status, which would destroy COD-ness if status were the only
    // signal. The missing payment record still proves it was never prepaid.
    expect(canUploadSlip({ paymentStatus: "รอชำระเงิน", hasPaymentRecord: false })).toBe(false);
  });

  it("given a prepaid order awaiting the transfer > true (the one case that wants a slip)", () => {
    expect(canUploadSlip({ paymentStatus: "รอชำระเงิน", hasPaymentRecord: true })).toBe(true);
  });

  it("given an order already paid > false (nothing left to prove)", () => {
    expect(canUploadSlip({ paymentStatus: "ชำระแล้ว", hasPaymentRecord: true })).toBe(false);
  });

  it("given an unknown or missing status > false (fail closed)", () => {
    expect(canUploadSlip({ paymentStatus: null, hasPaymentRecord: true })).toBe(false);
  });
});

describe("returnEligibility", () => {
  const base = {
    orderStatus: "สำเร็จ",
    completedAt: NOW - DAY,
    now: NOW,
    latestRequestStatus: null,
  };

  it("given the shop REJECTED the last request > blocked, and the reason says so", () => {
    // Without this the customer can simply re-file the claim the mechanic just refused — the button
    // reappears because the request is no longer "open". The self-serve path is exhausted; the only
    // way forward is a human, so the page sends them to LINE instead of looping.
    expect(returnEligibility({ ...base, latestRequestStatus: "ปฏิเสธ" })).toEqual({
      allowed: false,
      reason: "rejected",
    });
  });

  it("given a rejection, the window being open does NOT re-enable it", () => {
    const fresh = { ...base, completedAt: NOW - 1000, latestRequestStatus: "ปฏิเสธ" };
    expect(returnEligibility(fresh).allowed).toBe(false);
  });

  it("given a completed order inside the window > allowed", () => {
    expect(returnEligibility(base)).toEqual({ allowed: true, reason: "ok" });
  });

  it("given the order is not completed yet > not-completed", () => {
    expect(returnEligibility({ ...base, orderStatus: "กำลังจัดส่ง" })).toEqual({
      allowed: false,
      reason: "not-completed",
    });
  });

  it("given the 7-day window has passed > window-expired", () => {
    const expired = { ...base, completedAt: NOW - (RETURN_WINDOW_DAYS * DAY + 1) };
    expect(returnEligibility(expired)).toEqual({ allowed: false, reason: "window-expired" });
  });

  it("given exactly the last millisecond of the window > still allowed (boundary is inclusive)", () => {
    const edge = { ...base, completedAt: NOW - RETURN_WINDOW_DAYS * DAY };
    expect(returnEligibility(edge).allowed).toBe(true);
  });

  it("given a request is already open > already-requested (one at a time)", () => {
    expect(returnEligibility({ ...base, latestRequestStatus: "รอตรวจสอบ" })).toEqual({
      allowed: false,
      reason: "already-requested",
    });
  });

  it("given completedAt is unknown > allowed (fail OPEN — a mechanic approves every request anyway)", () => {
    expect(returnEligibility({ ...base, completedAt: null })).toEqual({
      allowed: true,
      reason: "ok",
    });
  });

  it("given an open request on a non-completed order > not-completed wins (clearer to the customer)", () => {
    expect(
      returnEligibility({ ...base, orderStatus: "ใหม่", latestRequestStatus: "รอตรวจสอบ" }).reason,
    ).toBe("not-completed");
  });
});
