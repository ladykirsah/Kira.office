import { describe, it, expect } from "vitest";
import {
  CANCEL_REASONS,
  CANCELLABLE_ORDER_STATUSES,
  cancelBlock,
  cancelReasonLabel,
  isCancelReason,
  paymentDeadline,
  slipAfterCancel,
} from "./orderCancel";

/**
 * The shop cancelling an AirPlus order (owner, 30 Oct 2026): only an order that has not been sent,
 * by the owner or an admin, with a reason. Stock, the coupon and the timeline are handled by the
 * API; these are the pure rules it leans on.
 */

describe("cancelBlock > which orders the shop may cancel", () => {
  it("given an unsent order (new / confirmed / packing) > then nothing blocks it", () => {
    for (const orderStatus of ["new", "confirmed", "packing"]) {
      expect(cancelBlock({ orderStatus, paymentStatus: "pending" })).toBeNull();
      expect(cancelBlock({ orderStatus, paymentStatus: "paid" })).toBeNull();
      expect(cancelBlock({ orderStatus, paymentStatus: "cod" })).toBeNull();
    }
  });

  it("given a COD order the shop refused > then it can still be cancelled", () => {
    expect(cancelBlock({ orderStatus: "new", paymentStatus: "cod_denied" })).toBeNull();
  });

  it("given a parcel already sent or past it > then it is a return or claim, not a cancel", () => {
    for (const orderStatus of [
      "shipped",
      "delivered",
      "delivery_failed",
      "claim_pending",
      "claimed",
      "claim_rejected",
    ]) {
      expect(cancelBlock({ orderStatus, paymentStatus: "paid" })).toBe("already_sent");
    }
  });

  it("given an order already cancelled or expired > then there is nothing to cancel", () => {
    expect(cancelBlock({ orderStatus: "cancelled", paymentStatus: "pending" })).toBe(
      "already_closed",
    );
    expect(cancelBlock({ orderStatus: "expired", paymentStatus: "expired" })).toBe(
      "already_closed",
    );
  });

  it("given a slip still waiting to be checked > then check the slip first", () => {
    expect(cancelBlock({ orderStatus: "new", paymentStatus: "verifying" })).toBe(
      "check_slip_first",
    );
  });

  it("given a status the system does not know > then it is not cancellable", () => {
    expect(cancelBlock({ orderStatus: "ใหม่", paymentStatus: "pending" })).toBe("already_sent");
  });

  it("the guarded UPDATE list matches the cancellable statuses", () => {
    expect([...CANCELLABLE_ORDER_STATUSES]).toEqual(["new", "confirmed", "packing"]);
  });
});

describe("cancel reasons", () => {
  it("the four reasons, customer first and อื่นๆ last (owner added ติดต่อลูกค้าไม่ได้, 30 Oct 2026)", () => {
    expect([...CANCEL_REASONS]).toEqual([
      "customer_request",
      "out_of_stock",
      "unreachable",
      "other",
    ]);
  });

  it("isCancelReason > accepts only the four", () => {
    expect(isCancelReason("out_of_stock")).toBe(true);
    expect(isCancelReason("unreachable")).toBe(true);
    expect(isCancelReason("ลูกค้าขอยกเลิก")).toBe(false);
    expect(isCancelReason(undefined)).toBe(false);
  });

  it("labels are the owner's Thai words", () => {
    expect(cancelReasonLabel("customer_request")).toBe("ลูกค้าขอยกเลิก");
    expect(cancelReasonLabel("out_of_stock")).toBe("สินค้าหมด");
    expect(cancelReasonLabel("unreachable")).toBe("ติดต่อลูกค้าไม่ได้");
    expect(cancelReasonLabel("other")).toBe("อื่นๆ");
  });
});

describe("slipAfterCancel > a customer pays after the shop cancelled", () => {
  const DEADLINE = 1_785_000_000_000;

  it("given a live order > then the cancel rule does not apply", () => {
    expect(
      slipAfterCancel(
        { orderStatus: "new", paymentStatus: "pending", payBy: DEADLINE },
        DEADLINE + 1,
      ),
    ).toBe("not_cancelled");
  });

  it("given a cancelled unpaid order before the payment deadline > then the slip is taken (we refund it)", () => {
    expect(
      slipAfterCancel(
        { orderStatus: "cancelled", paymentStatus: "pending", payBy: DEADLINE },
        DEADLINE - 1,
      ),
    ).toBe("take_slip");
  });

  it("given a cancelled order past the payment deadline > then no slip — contact us on LINE OA", () => {
    expect(
      slipAfterCancel(
        { orderStatus: "cancelled", paymentStatus: "pending", payBy: DEADLINE },
        DEADLINE,
      ),
    ).toBe("contact_line");
  });

  it("given a cancelled order with no deadline on file > then no slip — contact us on LINE OA", () => {
    expect(
      slipAfterCancel(
        { orderStatus: "cancelled", paymentStatus: "pending", payBy: null },
        DEADLINE,
      ),
    ).toBe("contact_line");
  });

  it("given a cancelled COD order > then there is nothing to pay — contact us on LINE OA", () => {
    expect(
      slipAfterCancel(
        { orderStatus: "cancelled", paymentStatus: "cod", payBy: DEADLINE },
        DEADLINE - 1,
      ),
    ).toBe("contact_line");
  });
});

describe("paymentDeadline > the clock a customer has to pay by", () => {
  it("given a deadline on the order (a rejected slip restarted it) > then that deadline", () => {
    expect(paymentDeadline({ paymentExpiresAt: 900, orderCreatedAt: 100 })).toBe(900);
  });

  it("given none > then the order time plus 48 hours", () => {
    expect(paymentDeadline({ paymentExpiresAt: null, orderCreatedAt: 100 })).toBe(
      100 + 48 * 60 * 60 * 1000,
    );
  });

  it("given no order time either > then unknown", () => {
    expect(paymentDeadline({ paymentExpiresAt: null, orderCreatedAt: null })).toBeNull();
  });
});
