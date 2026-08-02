import { describe, it, expect } from "vitest";
import { OPERATIONAL_STATUSES } from "@l-shopee/core";
import {
  operationalStatusBadge,
  saleStatusPill,
  paymentPill,
  orderStatusPill,
  vehicleLabel,
  stripCarYear,
  carYearOf,
  saleTypeBadge,
  shopeeStatusBadge,
  airplusStatusBadge,
} from "./badges";

describe("saleStatusPill", () => {
  it("given completed > then good", () => expect(saleStatusPill("completed")).toBe("good"));
  it("given refunded > then off", () => expect(saleStatusPill("refunded")).toBe("off"));
  it("given anything else > then warn", () => expect(saleStatusPill("pending")).toBe("warn"));
});

describe("paymentPill", () => {
  it("given paid > then good", () => expect(paymentPill("paid")).toBe("good"));
  it("given unpaid > then bad", () => expect(paymentPill("unpaid")).toBe("bad"));
  it("given pending > then warn", () => expect(paymentPill("pending")).toBe("warn"));
  it("given null > then off", () => expect(paymentPill(null)).toBe("off"));
});

describe("orderStatusPill", () => {
  it("given completed > then good", () => expect(orderStatusPill("completed")).toBe("good"));
  it("given shipped > then good", () => expect(orderStatusPill("shipped")).toBe("good"));
  it("given to_ship > then warn", () => expect(orderStatusPill("to_ship")).toBe("warn"));
  it("given cancelled > then bad", () => expect(orderStatusPill("cancelled")).toBe("bad"));
  it("given null > then off", () => expect(orderStatusPill(null)).toBe("off"));
});

describe("vehicleLabel", () => {
  it("given vehicle and plate > then joined with a dot", () =>
    expect(vehicleLabel("Toyota Vios 2014", "1กก 1234")).toBe("Toyota Vios 2014 · 1กก 1234"));
  it("given plate only > then plate", () =>
    expect(vehicleLabel(null, "1กก 1234")).toBe("1กก 1234"));
  it("given vehicle only > then vehicle", () =>
    expect(vehicleLabel("Honda City", "")).toBe("Honda City"));
  it("given neither > then empty string", () => expect(vehicleLabel(null, null)).toBe(""));
});

describe("stripCarYear", () => {
  it("given a model ending in a year > drops the year", () =>
    expect(stripCarYear("Toyota Vios 2014")).toBe("Toyota Vios"));
  it("given a model with no year > returns it unchanged", () =>
    expect(stripCarYear("Toyota Vios")).toBe("Toyota Vios"));
  it("given a model whose name contains a number > drops only the trailing year", () =>
    expect(stripCarYear("Mazda 2 2019")).toBe("Mazda 2"));
  it("given empty/nullish > then empty string", () => {
    expect(stripCarYear("")).toBe("");
    expect(stripCarYear(null)).toBe("");
    expect(stripCarYear(undefined)).toBe("");
  });
});

describe("carYearOf", () => {
  it("given a model ending in a year > returns just the year", () =>
    expect(carYearOf("Toyota Vios 2014")).toBe("2014"));
  it("given a model whose name contains a number > returns only the trailing year", () =>
    expect(carYearOf("Mazda 2 2019")).toBe("2019"));
  it("given no trailing year > returns empty string", () => {
    expect(carYearOf("Toyota Vios")).toBe("");
    expect(carYearOf("")).toBe("");
    expect(carYearOf(null)).toBe("");
  });
});

describe("saleTypeBadge", () => {
  it("given repair > then soft pill with Service label", () =>
    expect(saleTypeBadge("repair")).toEqual({ pill: "soft", label: "🔧 Service" }));
  it("given parts > then off pill with Products label", () =>
    expect(saleTypeBadge("parts")).toEqual({ pill: "off", label: "📦 Products" }));
  it("given null > then null", () => expect(saleTypeBadge(null)).toBeNull());
});

describe("shopeeStatusBadge", () => {
  it("สำเร็จแล้ว > Complete/green", () =>
    expect(shopeeStatusBadge("สำเร็จแล้ว")).toEqual({ pill: "good", label: "Complete" }));
  it("buyer-received (mentions refund) > Shipped/blue, not Refund", () =>
    expect(
      shopeeStatusBadge(
        "ผู้ซื้อได้รับสินค้าแล้ว โปรดทราบว่าผู้ซื้อสามารถยื่นคำขอคืนเงิน/คืนสินค้าได้จนถึง 2026-07-03",
      ),
    ).toEqual({ pill: "info", label: "Shipped" }));
  it("กำลังจัดส่ง > Shipping/yellow", () =>
    expect(shopeeStatusBadge("กำลังจัดส่ง")).toEqual({ pill: "warn", label: "Shipping" }));
  it("ยกเลิกแล้ว > Cancelled/gray", () =>
    expect(shopeeStatusBadge("ยกเลิกแล้ว")).toEqual({ pill: "off", label: "Cancelled" }));
  it("คืนเงินสำเร็จ > Refund/red", () =>
    expect(shopeeStatusBadge("การคืนเงิน/คืนสินค้าสำเร็จ")).toEqual({
      pill: "bad",
      label: "Refund",
    }));
});

describe("airplusStatusBadge (Refund=gray, Cancelled=red — opposite of Shopee)", () => {
  it("done > Done/green", () =>
    expect(airplusStatusBadge("done")).toEqual({ pill: "good", label: "Done" }));
  it("shipping > Shipping/yellow", () =>
    expect(airplusStatusBadge("shipping")).toEqual({ pill: "warn", label: "Shipping" }));
  it("refund > Refund/gray", () =>
    expect(airplusStatusBadge("refund")).toEqual({ pill: "off", label: "Refund" }));
  it("cancelled > Cancelled/red", () =>
    expect(airplusStatusBadge("cancelled")).toEqual({ pill: "bad", label: "Cancelled" }));
});

describe("operationalStatusBadge (the /orders Status column)", () => {
  /**
   * Colour is gray by DEFAULT here, which is the opposite of the older badge helpers above. The
   * owner's rule (30 Jul 2026): only a state that needs them to act earns a colour, because a column
   * where everything is coloured highlights nothing. These assertions exist so a later "let's make
   * complete green" cannot quietly undo that.
   */
  it("COD pending is yellow — waiting on the owner's COD decision", () =>
    expect(operationalStatusBadge("new", "cod")).toEqual({ pill: "warn", label: "COD pending" }));

  it("To ship is blue — waiting to be packed and sent", () =>
    expect(operationalStatusBadge("confirmed", "paid")).toEqual({
      pill: "info",
      label: "To ship",
    }));

  it("Return is red — ตีกลับ, the parcel came back and needs handling", () =>
    expect(operationalStatusBadge("delivery_failed", "paid")).toEqual({
      pill: "bad",
      label: "Return",
    }));

  it("everything else is gray, because nothing is waiting on the owner", () => {
    expect(operationalStatusBadge("new", "pending")).toEqual({ pill: "off", label: "Unpaid" });
    expect(operationalStatusBadge("shipped", "paid")).toEqual({ pill: "off", label: "In transit" });
    expect(operationalStatusBadge("delivered", "paid")).toEqual({ pill: "off", label: "Complete" });
    expect(operationalStatusBadge("cancelled", "pending")).toEqual({ pill: "off", label: "Fail" });
    expect(operationalStatusBadge("new", "verifying")).toEqual({
      pill: "off",
      label: "Payment pending",
    });
    expect(operationalStatusBadge("claim_pending", "paid")).toEqual({
      pill: "off",
      label: "Claim pending",
    });
    expect(operationalStatusBadge("claimed", "refunded")).toEqual({ pill: "off", label: "Refund" });
  });

  it("exactly three of the seven are coloured", () => {
    const coloured = OPERATIONAL_STATUSES.filter((s) => {
      // Drive each status through a representative (orderStatus, paymentStatus) pair.
      const pairs: Record<string, [string, string]> = {
        unpaid: ["new", "pending"],
        verifying: ["new", "verifying"],
        cod_pending: ["new", "cod"],
        cod_reject: ["new", "cod_denied"],
        to_ship: ["confirmed", "paid"],
        in_transit: ["shipped", "paid"],
        complete: ["delivered", "paid"],
        return: ["delivery_failed", "paid"],
        claim_pending: ["claim_pending", "paid"],
        claimed: ["claimed", "paid"],
        refunded: ["claimed", "refunded"],
        claim_rejected: ["claim_rejected", "paid"],
        fail: ["cancelled", "pending"],
      };
      const [os, ps] = pairs[s]!;
      return operationalStatusBadge(os, ps).pill !== "off";
    });
    expect([...coloured]).toEqual(["cod_pending", "to_ship", "return"]);
  });

  it("given pre-0069 Thai data > stays gray and shows the raw value rather than guessing", () =>
    expect(operationalStatusBadge("ใหม่", "รอชำระเงิน")).toEqual({ pill: "off", label: "ใหม่" }));

  it("given nothing at all > shows a dash", () =>
    expect(operationalStatusBadge(null, null)).toEqual({ pill: "off", label: "—" }));
});
