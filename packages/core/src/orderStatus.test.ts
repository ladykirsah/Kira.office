import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  orderStatusLabel,
  paymentStatusLabel,
  isOrderStatus,
  isPaymentStatus,
  isCreditEvent,
  creditEventFromOrder,
  computeCreditFromOrders,
  isOrderExpirable,
  EXPIRY_MS,
  type OrderStatus,
  type PaymentStatus,
} from "./orderStatus";

describe("ORDER_STATUSES", () => {
  it("contains the full AirPlus fulfilment lifecycle", () => {
    expect(ORDER_STATUSES).toEqual([
      "new",
      "confirmed",
      "packing",
      "shipped",
      "delivered",
      "cancelled",
      "expired",
    ]);
  });
});

describe("PAYMENT_STATUSES", () => {
  it("contains the full AirPlus payment lifecycle", () => {
    expect(PAYMENT_STATUSES).toEqual([
      "pending",
      "paid",
      "cod",
      "cod_confirmed",
      "cod_collected",
      "cod_denied",
      "expired",
      "refunded",
    ]);
  });
});

describe("orderStatusLabel", () => {
  it("given each status > returns a Thai display label", () => {
    expect(orderStatusLabel("new")).toBe("ใหม่");
    expect(orderStatusLabel("confirmed")).toBe("ยืนยันแล้ว");
    expect(orderStatusLabel("packing")).toBe("เตรียมจัดส่ง");
    expect(orderStatusLabel("shipped")).toBe("กำลังจัดส่ง");
    expect(orderStatusLabel("delivered")).toBe("สำเร็จ");
    expect(orderStatusLabel("cancelled")).toBe("ยกเลิก");
    expect(orderStatusLabel("expired")).toBe("หมดอายุ");
  });
});

describe("paymentStatusLabel", () => {
  it("given each status > returns a Thai display label", () => {
    expect(paymentStatusLabel("pending")).toBe("รอชำระเงิน");
    expect(paymentStatusLabel("paid")).toBe("ชำระแล้ว");
    expect(paymentStatusLabel("cod")).toBe("เก็บเงินปลายทาง");
    expect(paymentStatusLabel("cod_confirmed")).toBe("COD อนุมัติ");
    expect(paymentStatusLabel("cod_collected")).toBe("เก็บเงินแล้ว");
    expect(paymentStatusLabel("cod_denied")).toBe("COD ปฏิเสธ");
    expect(paymentStatusLabel("expired")).toBe("หมดอายุ");
    expect(paymentStatusLabel("refunded")).toBe("คืนเงิน");
  });
});

describe("isOrderStatus", () => {
  it("given valid statuses > returns true", () => {
    for (const s of ORDER_STATUSES) {
      expect(isOrderStatus(s)).toBe(true);
    }
  });

  it("given Thai legacy values > returns false", () => {
    expect(isOrderStatus("ใหม่")).toBe(false);
    expect(isOrderStatus("เตรียมจัดส่ง")).toBe(false);
  });

  it("given garbage > returns false", () => {
    expect(isOrderStatus("")).toBe(false);
    expect(isOrderStatus("foo")).toBe(false);
  });
});

describe("isPaymentStatus", () => {
  it("given valid statuses > returns true", () => {
    for (const s of PAYMENT_STATUSES) {
      expect(isPaymentStatus(s)).toBe(true);
    }
  });

  it("given Thai legacy values > returns false", () => {
    expect(isPaymentStatus("รอชำระเงิน")).toBe(false);
    expect(isPaymentStatus("ชำระแล้ว")).toBe(false);
  });
});

describe("isCreditEvent", () => {
  it("given delivered order > is a credit event (complete)", () => {
    expect(isCreditEvent("delivered")).toBe(true);
  });

  it("given expired order > is a credit event (incomplete)", () => {
    expect(isCreditEvent("expired")).toBe(true);
  });

  it("given cancelled order > is a credit event (incomplete)", () => {
    expect(isCreditEvent("cancelled")).toBe(true);
  });

  it("given mid-flight statuses > not a credit event yet", () => {
    expect(isCreditEvent("new")).toBe(false);
    expect(isCreditEvent("confirmed")).toBe(false);
    expect(isCreditEvent("packing")).toBe(false);
    expect(isCreditEvent("shipped")).toBe(false);
  });
});

describe("creditEventFromOrder", () => {
  it("given delivered order > complete (+1)", () => {
    expect(creditEventFromOrder("delivered", "paid")).toEqual({
      type: "complete",
    });
  });

  it("given delivered COD order > complete (+1)", () => {
    expect(creditEventFromOrder("delivered", "cod_collected")).toEqual({
      type: "complete",
    });
  });

  it("given expired unpaid order > incomplete (-1)", () => {
    expect(creditEventFromOrder("expired", "expired")).toEqual({
      type: "incomplete",
    });
  });

  it("given cancelled order with pending payment > incomplete (-1)", () => {
    expect(creditEventFromOrder("cancelled", "pending")).toEqual({
      type: "incomplete",
    });
  });

  it("given COD denied > incomplete (-1)", () => {
    expect(creditEventFromOrder("cancelled", "cod_denied")).toEqual({
      type: "incomplete",
    });
  });

  it("given cancelled but already paid (shop cancelled) > not counted", () => {
    expect(creditEventFromOrder("cancelled", "paid")).toBeNull();
  });

  it("given cancelled with refund > not counted (product failure return)", () => {
    expect(creditEventFromOrder("cancelled", "refunded")).toBeNull();
  });

  it("given mid-flight order > no event yet", () => {
    expect(creditEventFromOrder("new", "pending")).toBeNull();
    expect(creditEventFromOrder("shipped", "paid")).toBeNull();
  });
});

describe("computeCreditFromOrders", () => {
  it("given no orders > credit 0", () => {
    expect(computeCreditFromOrders([])).toBe(0);
  });

  it("given a mix of delivered and expired > net credit", () => {
    expect(
      computeCreditFromOrders([
        { orderStatus: "delivered", paymentStatus: "paid" },
        { orderStatus: "delivered", paymentStatus: "cod_collected" },
        { orderStatus: "expired", paymentStatus: "expired" },
      ]),
    ).toBe(1);
  });

  it("given mid-flight orders > ignores them", () => {
    expect(
      computeCreditFromOrders([
        { orderStatus: "new", paymentStatus: "pending" },
        { orderStatus: "shipped", paymentStatus: "paid" },
        { orderStatus: "delivered", paymentStatus: "paid" },
      ]),
    ).toBe(1);
  });

  it("given cancelled-with-refund (product fault) > not counted", () => {
    expect(
      computeCreditFromOrders([
        { orderStatus: "delivered", paymentStatus: "paid" },
        { orderStatus: "cancelled", paymentStatus: "refunded" },
        { orderStatus: "cancelled", paymentStatus: "refunded" },
      ]),
    ).toBe(1);
  });

  it("given non-standard statuses (Shopee) > skips them safely", () => {
    expect(
      computeCreditFromOrders([
        { orderStatus: "สำเร็จ", paymentStatus: "paid" },
        { orderStatus: "delivered", paymentStatus: "paid" },
        { orderStatus: null, paymentStatus: null },
      ]),
    ).toBe(1);
  });
});

describe("EXPIRY_MS", () => {
  it("is exactly 48 hours in milliseconds", () => {
    expect(EXPIRY_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe("isOrderExpirable", () => {
  const now = 1_700_200_000_000;

  it("given new+pending order older than 48h > expirable", () => {
    expect(
      isOrderExpirable(
        { orderStatus: "new", paymentStatus: "pending", orderCreatedAt: now - EXPIRY_MS - 1 },
        now,
      ),
    ).toBe(true);
  });

  it("given new+pending order exactly at 48h > expirable", () => {
    expect(
      isOrderExpirable(
        { orderStatus: "new", paymentStatus: "pending", orderCreatedAt: now - EXPIRY_MS },
        now,
      ),
    ).toBe(true);
  });

  it("given new+pending order under 48h > not expirable", () => {
    expect(
      isOrderExpirable(
        { orderStatus: "new", paymentStatus: "pending", orderCreatedAt: now - EXPIRY_MS + 1 },
        now,
      ),
    ).toBe(false);
  });

  it("given COD order older than 48h > NOT expirable (COD is a valid payment choice)", () => {
    expect(
      isOrderExpirable(
        { orderStatus: "new", paymentStatus: "cod", orderCreatedAt: now - EXPIRY_MS - 1 },
        now,
      ),
    ).toBe(false);
  });

  it("given confirmed+pending order older than 48h > NOT expirable (shop already confirmed)", () => {
    expect(
      isOrderExpirable(
        { orderStatus: "confirmed", paymentStatus: "pending", orderCreatedAt: now - EXPIRY_MS - 1 },
        now,
      ),
    ).toBe(false);
  });

  it("given already delivered order > NOT expirable", () => {
    expect(
      isOrderExpirable(
        { orderStatus: "delivered", paymentStatus: "paid", orderCreatedAt: now - EXPIRY_MS - 1 },
        now,
      ),
    ).toBe(false);
  });
});
