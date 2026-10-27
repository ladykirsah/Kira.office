import { describe, expect, it } from "vitest";
import {
  billDate,
  buildSale,
  nextSaleNumber,
  overSold,
  priceTag,
  saleLines,
  saleRefusal,
  saleSaved,
  saleTotal,
  unitPrice,
} from "./scanSale";
import type { ScanCard, ScannedPart } from "./scanTabs";

const part = (over: Partial<ScannedPart> = {}): ScannedPart => ({
  variantId: "v1",
  productId: "p1",
  productRef: "TY-VIGO-08",
  name: "วาล์วแอร์ Toyota Vigo",
  brandName: null,
  barcode: "TY-VIGO-08",
  photoKeys: [],
  onHand: 4,
  held: 0,
  unitPriceSatang: 65000,
  b2bPriceSatang: 58000,
  unitCostSatang: 44000,
  ...over,
});

const oil = part({
  variantId: "v3",
  productRef: "ND-OIL-8",
  name: "น้ำมันคอมแอร์ ND-OIL 8",
  brandName: "DENSO",
  barcode: "8850001112223",
  unitPriceSatang: 32000,
  b2bPriceSatang: 29000,
  unitCostSatang: 18000,
});

const sale: ScanCard[] = [
  { part: oil, value: 2 },
  { part: part(), value: 1 },
];

describe("unitPrice", () => {
  it("given ลูกค้า > then the walk-in price; given ช่าง > then the mechanic price", () => {
    expect(unitPrice(part(), "customer")).toBe(65000);
    expect(unitPrice(part(), "mechanic")).toBe(58000);
  });

  it("given ช่าง and no mechanic price set > then the walk-in price, as ทำบิล does", () => {
    expect(unitPrice(part({ b2bPriceSatang: 0 }), "mechanic")).toBe(65000);
  });
});

describe("priceTag", () => {
  it("shows the walk-in price with the mechanic price in brackets: ฿3,450 (3,100)", () => {
    expect(priceTag(part({ unitPriceSatang: 345000, b2bPriceSatang: 310000 }))).toEqual({
      price: "฿3,450",
      mechanic: "(3,100)",
    });
  });
});

describe("saleTotal", () => {
  it("adds up each part's price times how many, at the buyer's price", () => {
    expect(saleTotal(sale, "customer")).toBe(32000 * 2 + 65000);
    expect(saleTotal(sale, "mechanic")).toBe(29000 * 2 + 58000);
  });
});

describe("saleLines", () => {
  it("turns the cards into bill lines as ทำบิล writes them: name · brand, the scanned barcode, the buyer's price, cost kept for profit", () => {
    expect(saleLines(sale, "mechanic")).toEqual([
      {
        productVariantId: "v3",
        lineType: "part",
        description: "น้ำมันคอมแอร์ ND-OIL 8 · DENSO",
        barcodeValue: "8850001112223",
        quantity: 2,
        unitPriceSatang: 29000,
        unitCostSatang: 18000,
      },
      {
        productVariantId: "v1",
        lineType: "part",
        description: "วาล์วแอร์ Toyota Vigo",
        barcodeValue: "TY-VIGO-08",
        quantity: 1,
        unitPriceSatang: 58000,
        unitCostSatang: 44000,
      },
    ]);
  });
});

describe("overSold", () => {
  it("given more to sell than is for sale > then those parts are named before taking money", () => {
    const cards: ScanCard[] = [
      { part: oil, value: 5 }, // 4 for sale
      { part: part(), value: 4 },
    ];
    expect(overSold(cards).map((c) => c.part.variantId)).toEqual(["v3"]);
  });
});

describe("nextSaleNumber", () => {
  const ts = (y: number, m: number, d: number) => new Date(y, m, d, 14, 32).getTime();

  it("given no bill yet today > then the day starts at 001 in the shop's DASyyyymm-ddnnn form", () => {
    expect(nextSaleNumber([], ts(2026, 9, 26))).toBe("DAS202610-26001");
  });

  it("given bills today from any device > then it follows the highest one", () => {
    expect(
      nextSaleNumber(
        ["DAS202610-26003", "DAS202610-26007", null, "DAS202610-26005"],
        ts(2026, 9, 26),
      ),
    ).toBe("DAS202610-26008");
  });

  it("given only earlier days and other series > then today starts at 001", () => {
    expect(nextSaleNumber(["DAS202610-25009", "QT202610-26004", "nonsense"], ts(2026, 9, 26))).toBe(
      "DAS202610-26001",
    );
  });
});

describe("buildSale", () => {
  it("is the same sale record ทำบิล sends: parts sale, the bill number, how it was paid", () => {
    const lines = saleLines([{ part: oil, value: 2 }], "mechanic");
    expect(
      buildSale({
        clientUuid: "u-1",
        saleNumber: "DAS202610-26008",
        paymentMethod: "promptpay",
        lines,
      }),
    ).toEqual({
      clientUuid: "u-1",
      saleNumber: "DAS202610-26008",
      paymentMethod: "promptpay",
      saleType: "parts",
      lines,
    });
  });
});

describe("saleSaved", () => {
  const ok = { applied: 1, duplicates: 0, conflicts: [], validationErrors: [] };

  it("given the sale applied, or already saved by an earlier try > then it is saved", () => {
    expect(saleSaved(ok)).toBe(true);
    expect(saleSaved({ ...ok, applied: 0, duplicates: 1 })).toBe(true);
  });

  it("given a stock conflict or a refused line > then it is not saved", () => {
    expect(
      saleSaved({
        ...ok,
        applied: 0,
        conflicts: [{ productVariantId: "v1", requested: 5, available: 4 }],
      }),
    ).toBe(false);
    expect(
      saleSaved({
        ...ok,
        applied: 0,
        validationErrors: [{ clientUuid: "u-1", reason: "bad line" }],
      }),
    ).toBe(false);
  });
});

describe("saleRefusal", () => {
  it("given too little stock > then it says how many there are", () => {
    expect(
      saleRefusal({
        applied: 0,
        duplicates: 0,
        conflicts: [{ productVariantId: "v1", requested: 5, available: 4 }],
        validationErrors: [],
      }).th,
    ).toBe("สต็อกไม่พอ: มี 4 ขอ 5 แก้จำนวนแล้วลองอีกครั้ง");
  });

  it("given a refused line > then it passes on the system's own reason", () => {
    expect(
      saleRefusal({
        applied: 0,
        duplicates: 0,
        conflicts: [],
        validationErrors: [{ clientUuid: "u-1", reason: "quantity must be positive" }],
      }).th,
    ).toBe("ระบบไม่รับบิลนี้: quantity must be positive");
  });
});

describe("billDate", () => {
  it("writes the date the Thai way, Buddhist year, and the time on a 24-hour clock", () => {
    expect(billDate(new Date(2026, 9, 26, 14, 32).getTime())).toEqual({
      date: "26 ต.ค. 2569",
      time: "14:32",
    });
    expect(billDate(new Date(2027, 0, 5, 9, 5).getTime())).toEqual({
      date: "5 ม.ค. 2570",
      time: "09:05",
    });
  });
});
