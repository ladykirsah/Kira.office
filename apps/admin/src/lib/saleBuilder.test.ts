import { describe, it, expect } from "vitest";
import { buildQueuedSale, type BillForSale } from "./saleBuilder";

const bill: BillForSale = {
  saleNumber: "DAS202607-29001",
  plate: "1กท1111",
  vehicle: "Toyota Vigo 2012",
  note: "ล้างแอร์ครบชุด",
  discountSatang: 0,
  lines: [
    {
      kind: "part",
      name: "Compressor",
      productVariantId: "v1",
      barcodeValue: "88512345",
      quantity: 2,
      unitPriceSatang: 100000,
      unitCostSatang: 60000,
    },
    {
      kind: "service",
      name: "ล้างแอร์",
      quantity: 1,
      unitPriceSatang: 150000,
      unitCostSatang: 0,
    },
  ],
};

const uuid = () => "fixed-uuid";
const now = 1_785_000_000_000;

describe("buildQueuedSale", () => {
  it("carries the payment method that was actually taken", () => {
    expect(buildQueuedSale(bill, { paymentMethod: "promptpay" }, uuid, now).paymentMethod).toBe(
      "promptpay",
    );
    expect(buildQueuedSale(bill, { paymentMethod: "cash" }, uuid, now).paymentMethod).toBe("cash");
  });

  it("records who took a cash payment, in the note", () => {
    const sale = buildQueuedSale(bill, { paymentMethod: "cash", receivedBy: " สมชาย " }, uuid, now);
    expect(sale.notes).toBe("ล้างแอร์ครบชุด · รับเงินโดย สมชาย");
  });

  it("given no note > the cash receiver still gets recorded", () => {
    const sale = buildQueuedSale(
      { ...bill, note: "" },
      { paymentMethod: "cash", receivedBy: "สมชาย" },
      uuid,
      now,
    );
    expect(sale.notes).toBe("รับเงินโดย สมชาย");
  });

  it("given PromptPay > does not tack a receiver onto the note", () => {
    const sale = buildQueuedSale(
      bill,
      { paymentMethod: "promptpay", receivedBy: "สมชาย" },
      uuid,
      now,
    );
    expect(sale.notes).toBe("ล้างแอร์ครบชุด");
  });

  it("a bill with a vehicle or plate is a repair, not a parts sale", () => {
    expect(buildQueuedSale(bill, { paymentMethod: "cash" }, uuid, now).saleType).toBe("repair");
    expect(
      buildQueuedSale(
        { ...bill, plate: "", vehicle: "", lines: [bill.lines[0]] },
        { paymentMethod: "cash" },
        uuid,
        now,
      ).saleType,
    ).toBe("parts");
  });

  it("spreads the bill discount across the lines so per-line profit stays exact", () => {
    const sale = buildQueuedSale(
      { ...bill, discountSatang: 50000 },
      { paymentMethod: "cash" },
      uuid,
      now,
    );
    const spread = sale.lines.map((l) => l.discountSatang ?? 0);
    expect(spread.reduce((a, b) => a + b, 0)).toBe(50000); // nothing lost or invented
    expect(spread[0]).toBeGreaterThan(spread[1]); // the bigger line absorbs more
  });

  it("keeps each line's identity so stock and cost land on the right variant", () => {
    const sale = buildQueuedSale(bill, { paymentMethod: "cash" }, uuid, now);
    expect(sale.lines[0]).toMatchObject({
      productVariantId: "v1",
      lineType: "part",
      description: "Compressor",
      barcodeValue: "88512345",
      quantity: 2,
      unitPriceSatang: 100000,
      unitCostSatang: 60000,
    });
    // A service line never carries a variant — it moves no stock.
    expect(sale.lines[1].productVariantId).toBeNull();
  });
});
