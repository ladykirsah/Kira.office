import { describe, expect, it } from "vitest";
import {
  addScan,
  afterSale,
  cartKey,
  keepAfterSave,
  changedCards,
  holdMoves,
  needsReason,
  readTab,
  step,
  stepLabel,
  stockLine,
  stockMoves,
  type ScanCard,
  type ScannedPart,
} from "./scanTabs";

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

const clutch = part({
  variantId: "v2",
  productId: "p2",
  productRef: "DN-447300",
  name: "คลัชคอม Toyota Vigo ดีเซล",
  onHand: 3,
  held: 2,
  unitPriceSatang: 345000,
  b2bPriceSatang: 310000,
  unitCostSatang: 263000,
});

const values = (cards: ScanCard[]) => cards.map((c) => [c.part.variantId, c.value]);

describe("readTab", () => {
  it("given a saved tab > then the screen opens on it", () => {
    expect(readTab("away")).toBe("away");
    expect(readTab("stock")).toBe("stock");
  });

  it("given nothing saved or an old Scan v1 mode > then it opens on ขาย, the first tab", () => {
    expect(readTab(null)).toBe("sell");
    expect(readTab("view")).toBe("sell");
  });
});

describe("addScan", () => {
  it("given ขาย > then a new part goes on top with 1 to sell", () => {
    expect(values(addScan(addScan([], part(), "sell"), clutch, "sell"))).toEqual([
      ["v2", 1],
      ["v1", 1],
    ]);
  });

  it("given งานนอก > then the number starts at what is out on jobs now", () => {
    expect(values(addScan([], clutch, "away"))).toEqual([["v2", 2]]);
  });

  it("given จัดการสต็อก > then the number starts at what is for sale now", () => {
    expect(values(addScan([], clutch, "stock"))).toEqual([["v2", 3]]);
  });

  it("given ขาย and a part already on the sale > then it sells one more and comes back on top", () => {
    const cards = addScan(addScan([], clutch, "sell"), part(), "sell");
    expect(values(addScan(cards, clutch, "sell"))).toEqual([
      ["v2", 2],
      ["v1", 1],
    ]);
  });

  it("given a stock tab and a part already there > then it comes back on top and keeps the number set", () => {
    const set: ScanCard[] = [
      { part: part(), value: 4 },
      { part: clutch, value: 5 },
    ];
    expect(values(addScan(set, clutch, "stock"))).toEqual([
      ["v2", 5],
      ["v1", 4],
    ]);
  });
});

describe("step", () => {
  const one = (value: number): ScanCard[] => [{ part: clutch, value }];

  it("given ขาย > then + sells one more and − one fewer", () => {
    expect(values(step(one(2), "v2", "sell", 1))).toEqual([["v2", 3]]);
    expect(values(step(one(2), "v2", "sell", -1))).toEqual([["v2", 1]]);
  });

  it("given ขาย at 1 > then − takes the part off the sale", () => {
    expect(step(one(1), "v2", "sell", -1)).toEqual([]);
  });

  it("given งานนอก > then it stops at none out and at everything in the shop out", () => {
    // clutch: 3 for sale + 2 out = 5 in all
    expect(values(step(one(0), "v2", "away", -1))).toEqual([["v2", 0]]);
    expect(values(step(one(5), "v2", "away", 1))).toEqual([["v2", 5]]);
    expect(values(step(one(4), "v2", "away", 1))).toEqual([["v2", 5]]);
  });

  it("given จัดการสต็อก > then it never goes below 0", () => {
    expect(values(step(one(0), "v2", "stock", -1))).toEqual([["v2", 0]]);
    expect(values(step(one(3), "v2", "stock", 1))).toEqual([["v2", 4]]);
  });

  it("given another card > then only the tapped card changes", () => {
    const cards: ScanCard[] = [
      { part: clutch, value: 3 },
      { part: part(), value: 4 },
    ];
    expect(values(step(cards, "v1", "stock", 1))).toEqual([
      ["v2", 3],
      ["v1", 5],
    ]);
  });
});

describe("stepLabel", () => {
  it("names what the number means on each tab", () => {
    expect(stepLabel("sell").th).toBe("จำนวนที่ขาย");
    expect(stepLabel("away").th).toBe("อยู่งานนอก");
    expect(stepLabel("stock").th).toBe("พร้อมขาย");
  });
});

describe("stockLine", () => {
  it("given ขาย or งานนอก > then it shows for sale and out on jobs now", () => {
    expect(stockLine(clutch, "sell").th).toBe("พร้อมขาย 3 · งานนอก 2");
    expect(stockLine(clutch, "away").th).toBe("พร้อมขาย 3 · งานนอก 2");
  });

  it("given จัดการสต็อก > then the label already says for sale, so the line starts with the number", () => {
    expect(stockLine(clutch, "stock").th).toBe("3 · งานนอก 2");
  });
});

describe("changedCards", () => {
  it("given a stock tab > then only cards whose number moved are saved", () => {
    const cards: ScanCard[] = [
      { part: clutch, value: 3 }, // for sale 3, unchanged
      { part: part(), value: 6 }, // for sale 4 → 6
    ];
    expect(values(changedCards(cards, "stock"))).toEqual([["v1", 6]]);
  });

  it("given งานนอก > then a card is changed when the number out differs from what is out now", () => {
    const cards: ScanCard[] = [
      { part: clutch, value: 2 }, // 2 out, unchanged
      { part: part(), value: 1 }, // 0 out → 1
    ];
    expect(values(changedCards(cards, "away"))).toEqual([["v1", 1]]);
  });
});

describe("holdMoves", () => {
  it("given more out than now > then the difference goes out; given fewer > then it comes back", () => {
    const cards: ScanCard[] = [
      { part: clutch, value: 3 }, // 2 → 3
      { part: part({ held: 2 }), value: 0 }, // 2 → 0
      { part: part({ variantId: "v3", held: 1 }), value: 1 }, // unchanged
    ];
    expect(holdMoves(cards)).toEqual([
      { productVariantId: "v2", takeAway: 1, bringBack: 0 },
      { productVariantId: "v1", takeAway: 0, bringBack: 2 },
    ]);
  });
});

describe("needsReason", () => {
  it("given a stock count lowered > then the screen must ask นับใหม่ or ของเสีย", () => {
    expect(needsReason([{ part: clutch, value: 2 }])).toBe(true);
  });

  it("given only counts raised or unchanged > then there is nothing to ask", () => {
    expect(
      needsReason([
        { part: clutch, value: 5 },
        { part: part(), value: 4 },
      ]),
    ).toBe(false);
  });
});

describe("stockMoves", () => {
  it("given a count raised > then the difference is received into stock", () => {
    expect(stockMoves([{ part: clutch, value: 5 }], null)).toEqual([
      {
        productVariantId: "v2",
        quantityDelta: 2,
        movementType: "receive",
        reason: "received via Scan",
      },
    ]);
  });

  it("given a count lowered for นับใหม่ > then the new count is recorded as a stocktake", () => {
    expect(stockMoves([{ part: clutch, value: 1 }], "recount")).toEqual([
      {
        productVariantId: "v2",
        countedOnHand: 1,
        movementType: "correction",
        reason: "recounted via Scan",
      },
    ]);
  });

  it("given a count lowered for ของเสีย > then the difference is written off", () => {
    expect(stockMoves([{ part: clutch, value: 1 }], "damaged")).toEqual([
      {
        productVariantId: "v2",
        quantityDelta: -2,
        movementType: "write_off",
        reason: "damaged or lost via Scan",
      },
    ]);
  });

  it("given an unchanged card > then nothing is recorded for it", () => {
    expect(stockMoves([{ part: clutch, value: 3 }], null)).toEqual([]);
  });

  it("given a count lowered and no reason picked > then it refuses rather than guess", () => {
    expect(() => stockMoves([{ part: clutch, value: 1 }], null)).toThrow();
  });
});

describe("afterSale", () => {
  it("given the sale went through > then what was sold comes off the ขาย list", () => {
    const sold: ScanCard[] = [
      { part: clutch, value: 1 },
      { part: part(), value: 2 },
    ];
    expect(afterSale(sold, sold)).toEqual([]);
  });

  it("given parts scanned while the sale was being paid > then they stay for the next sale", () => {
    const sold: ScanCard[] = [{ part: clutch, value: 1 }];
    const now: ScanCard[] = [
      { part: part(), value: 1 }, // scanned while the sheet was open
      { part: clutch, value: 2 }, // one more clutch scanned meanwhile
    ];
    expect(values(afterSale(now, sold))).toEqual([
      ["v1", 1],
      ["v2", 1],
    ]);
  });
});

describe("cartKey", () => {
  it("is the same for the same parts and amounts, in any order, and changes when an amount does", () => {
    const a: ScanCard[] = [
      { part: clutch, value: 1 },
      { part: part(), value: 2 },
    ];
    const b: ScanCard[] = [
      { part: part(), value: 2 },
      { part: clutch, value: 1 },
    ];
    expect(cartKey(a)).toBe(cartKey(b));
    expect(cartKey(a)).not.toBe(
      cartKey([
        { part: clutch, value: 2 },
        { part: part(), value: 2 },
      ]),
    );
  });
});

describe("keepAfterSave", () => {
  const cards: ScanCard[] = [
    { part: clutch, value: 5 },
    { part: part(), value: 1 },
    { part: part({ variantId: "v3" }), value: 7 },
    { part: part({ variantId: "v4" }), value: 2 }, // scanned while saving, not sent
  ];

  it("given each part's outcome > then saved parts go, refused ones stay to fix, and parts not sent stay", () => {
    const kept = keepAfterSave(cards, { v2: "applied", v1: "refused", v3: "unsure" });
    expect(kept.map((c) => c.part.variantId)).toEqual(["v1", "v4"]);
  });

  it("given a part whose outcome is unknown (the connection dropped) > then it goes too, so it is never sent twice", () => {
    expect(keepAfterSave(cards, { v3: "unsure" }).map((c) => c.part.variantId)).not.toContain("v3");
  });
});
