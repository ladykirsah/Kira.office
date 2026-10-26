import { describe, expect, it } from "vitest";
import {
  actionLabel,
  addPart,
  afterBilling,
  billLines,
  holdLines,
  partLine,
  partProblem,
  readMode,
  removePart,
  setQty,
  type ScannedPart,
} from "./scanList";

const part = (over: Partial<ScannedPart> = {}): ScannedPart => ({
  variantId: "v1",
  productId: "p1",
  productRef: "TY-VIGO-08",
  name: "วาล์วแอร์ Toyota Vigo",
  imageKey: null,
  onHand: 3,
  held: 0,
  unitPriceSatang: 65000,
  unitCostSatang: 44000,
  qty: 1,
  ...over,
});

const clutch = part({
  variantId: "v2",
  productId: "p2",
  productRef: "DN-447300",
  name: "คลัชคอม Toyota Vigo ดีเซล",
  onHand: 12,
  unitPriceSatang: 345000,
  unitCostSatang: 263000,
});

describe("readMode", () => {
  it("given a saved mode > then the screen opens on it", () => {
    expect(readMode("fill")).toBe("fill");
  });

  it("given nothing saved or something unknown > then it opens on View, which changes nothing", () => {
    expect(readMode(null)).toBe("view");
    expect(readMode("delete-everything")).toBe("view");
  });
});

describe("addPart", () => {
  it("given a new part > then it goes on top, nearest the camera", () => {
    expect(addPart([part()], clutch, "fill").map((p) => p.variantId)).toEqual(["v2", "v1"]);
  });

  it("given a part already in a bill > then scanning it again adds one more", () => {
    const list = addPart([part()], part(), "sell");
    expect(list).toHaveLength(1);
    expect(list[0]?.qty).toBe(2);
  });

  it("given a part already in a stock list > then the amount typed for it is kept", () => {
    const list = addPart([part({ qty: 5 })], part(), "fill");
    expect(list).toHaveLength(1);
    expect(list[0]?.qty).toBe(5);
  });
});

describe("setQty and removePart", () => {
  it("given a new amount > then only that part changes", () => {
    const list = setQty([part(), clutch], "v2", 4);
    expect(list.map((p) => p.qty)).toEqual([1, 4]);
  });

  it("given zero, a negative or a broken number > then the amount stays at least 1", () => {
    expect(setQty([part()], "v1", 0)[0]?.qty).toBe(1);
    expect(setQty([part()], "v1", -3)[0]?.qty).toBe(1);
    expect(setQty([part()], "v1", Number.NaN)[0]?.qty).toBe(1);
    expect(setQty([part()], "v1", 2.6)[0]?.qty).toBe(3);
  });

  it("given a part to remove > then the rest stay in order", () => {
    expect(removePart([clutch, part()], "v2").map((p) => p.variantId)).toEqual(["v1"]);
  });
});

describe("partLine", () => {
  it("given Fill stock > then it shows on-hand before and after", () => {
    expect(partLine(part({ qty: 3 }), "fill", "takeAway")).toEqual({
      th: "มีอยู่ 3 → 6",
      en: "On hand 3 → 6",
    });
  });

  it("given On hold, taking away > then it shows the hold growing", () => {
    expect(partLine(clutch, "hold", "takeAway")).toEqual({
      th: "พักอยู่ 0 → 1",
      en: "On hold 0 → 1",
    });
  });

  it("given On hold, bringing back > then it shows the hold shrinking", () => {
    expect(partLine(part({ held: 2 }), "hold", "bringBack")).toEqual({
      th: "พักอยู่ 2 → 1",
      en: "On hold 2 → 1",
    });
  });

  it("given a bill > then one piece shows its price and more show price × amount", () => {
    expect(partLine(clutch, "sell", "takeAway")).toEqual({ th: "฿3,450", en: "฿3,450" });
    expect(partLine(part({ unitPriceSatang: 32000, qty: 2 }), "sell", "takeAway")).toEqual({
      th: "฿320 × 2",
      en: "฿320 × 2",
    });
  });
});

describe("partProblem", () => {
  it("given more taken away than is for sale > then it says how many there are", () => {
    expect(partProblem(part({ qty: 4 }), "hold", "takeAway")).toEqual({
      th: "ขายได้อยู่ 3 ชิ้น",
      en: "Only 3 for sale",
    });
  });

  it("given more brought back than is on hold > then it says how many are on hold", () => {
    expect(partProblem(part({ held: 1, qty: 2 }), "hold", "bringBack")).toEqual({
      th: "พักอยู่แค่ 1 ชิ้น",
      en: "Only 1 on hold",
    });
  });

  it("given amounts that fit, or a mode that moves no stock out > then there is no problem", () => {
    expect(partProblem(part({ qty: 3 }), "hold", "takeAway")).toBeNull();
    expect(partProblem(part({ qty: 99 }), "fill", "takeAway")).toBeNull();
  });
});

describe("actionLabel", () => {
  const sellList = [clutch, part(), part({ variantId: "v3", unitPriceSatang: 32000, qty: 2 })];

  it("given a bill > then the button names the action and the total", () => {
    expect(actionLabel(sellList, "sell", "takeAway")).toEqual({
      th: "สร้างบิล · ฿4,740",
      en: "Create bill · ฿4,740",
    });
  });

  it("given stock to receive > then the button counts the pieces", () => {
    expect(
      actionLabel([part({ qty: 3 }), part({ variantId: "v4", qty: 2 })], "fill", "takeAway"),
    ).toEqual({ th: "รับเข้าสต็อก · 5 ชิ้น", en: "Receive · 5 pcs" });
  });

  it("given a hold batch > then the button says which way the stock moves", () => {
    const list = [clutch, part({ qty: 2 })];
    expect(actionLabel(list, "hold", "takeAway")).toEqual({
      th: "ย้ายไปพัก · 3 ชิ้น",
      en: "Put on hold · 3 pcs",
    });
    expect(actionLabel(list, "hold", "bringBack")).toEqual({
      th: "นำกลับเข้าร้าน · 3 ชิ้น",
      en: "Bring back · 3 pcs",
    });
  });
});

describe("holdLines and billLines", () => {
  it("given a hold batch > then every line moves the same way", () => {
    expect(holdLines([part({ qty: 2 })], "takeAway")).toEqual([
      { productVariantId: "v1", takeAway: 2, bringBack: 0 },
    ]);
    expect(holdLines([part({ qty: 2 })], "bringBack")).toEqual([
      { productVariantId: "v1", takeAway: 0, bringBack: 2 },
    ]);
  });

  it("given a bill > then each part becomes a priced bill line", () => {
    expect(billLines([part({ qty: 2 })])).toEqual([
      {
        productVariantId: "v1",
        lineType: "part",
        description: "วาล์วแอร์ Toyota Vigo",
        barcodeValue: "TY-VIGO-08",
        quantity: 2,
        unitPriceSatang: 65000,
        unitCostSatang: 44000,
      },
    ]);
  });
});

describe("afterBilling", () => {
  it("given the whole list was billed > then the list is empty", () => {
    const list = [part({ qty: 2 }), clutch];
    expect(afterBilling(list, billLines(list))).toEqual([]);
  });

  it("given more was scanned while the bill was saving > then only the extra stays", () => {
    const billed = billLines([part({ qty: 2 })]);
    const now = [clutch, part({ qty: 3 })];
    expect(afterBilling(now, billed)).toEqual([clutch, part({ qty: 1 })]);
  });
});
