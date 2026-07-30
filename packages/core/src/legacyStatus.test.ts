import { describe, it, expect } from "vitest";
import {
  normalizeOrderStatus,
  normalizePaymentStatus,
  LEGACY_ORDER_STATUS_TH,
  LEGACY_PAYMENT_STATUS_TH,
} from "./legacyStatus";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "./orderStatus";

/**
 * Migration 0069 rewrites the Thai status values to English constants, but the code that READS them
 * and the migration cannot land at the same instant. If the readers only understood English, a deploy
 * that beat the migration would show every customer a wrong status; if only Thai, a migration that
 * beat the deploy would do the same. On the AirPlus storefront that is not cosmetic — the
 * slip-upload block is gated on payment status, so getting it wrong takes away the only way an
 * unpaid customer can send us a transfer slip.
 *
 * So every reader normalizes first, and accepts both. Once 0069 has run everywhere and no Thai
 * remains, the LEGACY_* maps can be deleted and these tests will say so by failing.
 */
describe("normalizeOrderStatus", () => {
  it("passes an English constant straight through", () => {
    for (const s of ORDER_STATUSES) expect(normalizeOrderStatus(s)).toBe(s);
  });

  it("maps every legacy Thai value that migration 0069 knows", () => {
    expect(normalizeOrderStatus("ใหม่")).toBe("new");
    expect(normalizeOrderStatus("เตรียมจัดส่ง")).toBe("packing");
    expect(normalizeOrderStatus("กำลังจัดส่ง")).toBe("shipped");
    expect(normalizeOrderStatus("สำเร็จ")).toBe("delivered");
    expect(normalizeOrderStatus("ยกเลิก")).toBe("cancelled");
  });

  it("maps the Thai the admin's Sales tab could write but 0069 misses", () => {
    // That tab offers คืนเงิน as an ORDER status even though core treats it as a payment label, and
    // its free-text override lets any string through. 0069 folds คืนเงิน into cancelled + refunded.
    expect(normalizeOrderStatus("คืนเงิน")).toBe("cancelled");
    expect(normalizeOrderStatus("ยืนยันแล้ว")).toBe("confirmed");
  });

  it("tolerates surrounding whitespace, which the admin's free-text field allows", () => {
    expect(normalizeOrderStatus("  สำเร็จ  ")).toBe("delivered");
    expect(normalizeOrderStatus(" delivered ")).toBe("delivered");
  });

  it("returns null for nothing, rather than guessing", () => {
    expect(normalizeOrderStatus(null)).toBeNull();
    expect(normalizeOrderStatus("")).toBeNull();
    expect(normalizeOrderStatus("   ")).toBeNull();
  });

  it("returns null for a value from neither vocabulary", () => {
    expect(normalizeOrderStatus("whatever the admin typed")).toBeNull();
  });

  it("never maps a Thai value to a status that does not exist", () => {
    for (const th of Object.keys(LEGACY_ORDER_STATUS_TH)) {
      expect(ORDER_STATUSES).toContain(normalizeOrderStatus(th)!);
    }
  });
});

describe("normalizePaymentStatus", () => {
  it("passes an English constant straight through", () => {
    for (const s of PAYMENT_STATUSES) expect(normalizePaymentStatus(s)).toBe(s);
  });

  it("maps every legacy Thai value that migration 0069 knows", () => {
    expect(normalizePaymentStatus("รอชำระเงิน")).toBe("pending");
    expect(normalizePaymentStatus("ชำระแล้ว")).toBe("paid");
    expect(normalizePaymentStatus("เก็บเงินปลายทาง")).toBe("cod");
  });

  it("maps the newer Thai labels too, so a relabelled value still resolves", () => {
    expect(normalizePaymentStatus("ยังไม่ชำระเงิน")).toBe("pending");
    expect(normalizePaymentStatus("กำลังตรวจสอบ")).toBe("verifying");
    expect(normalizePaymentStatus("คืนเงิน")).toBe("refunded");
  });

  it("returns null for nothing or nonsense", () => {
    expect(normalizePaymentStatus(null)).toBeNull();
    expect(normalizePaymentStatus("")).toBeNull();
    expect(normalizePaymentStatus("¯\\_(ツ)_/¯")).toBeNull();
  });

  it("never maps a Thai value to a status that does not exist", () => {
    for (const th of Object.keys(LEGACY_PAYMENT_STATUS_TH)) {
      expect(PAYMENT_STATUSES).toContain(normalizePaymentStatus(th)!);
    }
  });
});

describe("the pair, on the states the storefront actually branches on", () => {
  /**
   * These are the exact decisions the customer-facing pages make. Each is asserted for BOTH
   * spellings, because during the migration window a single order can be read either way.
   */
  const cases: [string, string, string, string][] = [
    // [thai order, thai payment, english order, english payment]
    ["ใหม่", "รอชำระเงิน", "new", "pending"],
    ["ใหม่", "เก็บเงินปลายทาง", "new", "cod"],
    ["เตรียมจัดส่ง", "ชำระแล้ว", "packing", "paid"],
    ["กำลังจัดส่ง", "ชำระแล้ว", "shipped", "paid"],
    ["สำเร็จ", "ชำระแล้ว", "delivered", "paid"],
    ["ยกเลิก", "รอชำระเงิน", "cancelled", "pending"],
  ];

  it("resolves each pair identically whichever language it is stored in", () => {
    for (const [tho, thp, eno, enp] of cases) {
      expect(normalizeOrderStatus(tho)).toBe(normalizeOrderStatus(eno));
      expect(normalizePaymentStatus(thp)).toBe(normalizePaymentStatus(enp));
    }
  });

  it("an unpaid order resolves to pending in both languages — this gates the slip upload", () => {
    expect(normalizePaymentStatus("รอชำระเงิน")).toBe("pending");
    expect(normalizePaymentStatus("pending")).toBe("pending");
  });

  it("a COD order never resolves to pending, in either language", () => {
    // If it did, the storefront would offer a COD customer a slip upload they must not use.
    expect(normalizePaymentStatus("เก็บเงินปลายทาง")).not.toBe("pending");
    expect(normalizePaymentStatus("cod")).not.toBe("pending");
  });
});
