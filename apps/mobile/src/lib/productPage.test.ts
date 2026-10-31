import { describe, expect, it } from "vitest";
import {
  boxText,
  editedLine,
  galleryKeys,
  priceRows,
  weightText,
  type Pricing,
} from "./productPage";

const PRICING: Pricing = {
  itemCostSatang: 240000,
  taxOnCost: 1,
  targetPriceSatang: 345000,
  b2bPriceSatang: 310000,
  onlinePriceSatang: 369000,
  shopeePriceSatang: 400000,
  onlineCommissionBp: 1200,
};

describe("priceRows", () => {
  it("given someone who sees cost > then ต้นทุน first, as the total with VAT, then the four prices", () => {
    const rows = priceRows(PRICING, true);
    expect(rows.map((r) => [r.label.th, r.satang])).toEqual([
      ["ต้นทุน", 256800],
      ["เด่นแอร์", 345000],
      ["ช่าง", 310000],
      ["AirPlus", 369000],
      ["Shopee", 400000],
    ]);
  });

  it("given VAT on the cost > then ⌄ shows the item cost and the VAT added", () => {
    expect(priceRows(PRICING, true)[0]!.lines).toEqual([
      { label: { th: "ต้นทุนสินค้า", en: "Item cost" }, text: "฿2,400", loss: false },
      { label: { th: "VAT 7%", en: "VAT 7%" }, text: "+ ฿168", loss: false },
    ]);
  });

  it("given no VAT on the cost > then the cost has nothing to drop down", () => {
    expect(priceRows({ ...PRICING, taxOnCost: 0 }, true)[0]).toMatchObject({
      satang: 240000,
      lines: [],
    });
  });

  it("given a counter price > then ⌄ shows its profit over the total cost", () => {
    expect(priceRows(PRICING, true)[1]!.lines).toEqual([
      { label: { th: "กำไร", en: "Profit" }, text: "฿882 · 26%", loss: false },
    ]);
  });

  it("given the Shopee price > then ⌄ takes Shopee's fee off first", () => {
    expect(priceRows(PRICING, true)[4]!.lines).toEqual([
      { label: { th: "ค่าคอม 12%", en: "Fee 12%" }, text: "– ฿480", loss: false },
      { label: { th: "กำไร", en: "Profit" }, text: "฿952 · 24%", loss: false },
    ]);
  });

  it("given a price under the cost > then the profit says so as a loss", () => {
    const rows = priceRows({ ...PRICING, b2bPriceSatang: 250000 }, true);
    expect(rows[2]!.lines).toEqual([
      { label: { th: "ขาดทุน", en: "Loss" }, text: "฿68", loss: true },
    ]);
  });

  it("given a price not set > then nothing to drop down", () => {
    expect(priceRows({ ...PRICING, shopeePriceSatang: 0 }, true)[4]).toMatchObject({
      satang: 0,
      lines: [],
    });
  });

  it("given someone who may not see cost > then no ต้นทุน row and no ⌄ on the prices", () => {
    const rows = priceRows(PRICING, false);
    expect(rows.map((r) => r.label.th)).toEqual(["เด่นแอร์", "ช่าง", "AirPlus", "Shopee"]);
    expect(rows.every((r) => r.lines.length === 0)).toBe(true);
  });

  it("given no prices at all > then the four prices with nothing set", () => {
    expect(priceRows(null, false).map((r) => r.satang)).toEqual([0, 0, 0, 0]);
  });
});

describe("weightText / boxText", () => {
  it("given grams > then kilograms", () => {
    expect(weightText(6800)).toEqual({ th: "6.8 กก.", en: "6.8 kg" });
  });
  it("given no weight > then a dash", () => {
    expect(weightText(0)).toEqual({ th: "—", en: "—" });
  });
  it("given all three sides > then width × length × height in centimetres", () => {
    expect(boxText(300, 250, 255)).toEqual({ th: "30 × 25 × 25.5 ซม.", en: "30 × 25 × 25.5 cm" });
  });
  it("given a side missing > then a dash", () => {
    expect(boxText(300, null, 250)).toEqual({ th: "—", en: "—" });
  });
});

describe("editedLine", () => {
  it("given an edit date > then แก้ไขล่าสุด with the Thai date", () => {
    expect(editedLine(new Date(2026, 9, 26, 9, 0).getTime())).toEqual({
      th: "แก้ไขล่าสุด 26 ต.ค. 2569",
      en: "Last edited 26 Oct 2026",
    });
  });
  it("given none > then no line", () => {
    expect(editedLine(null)).toBeNull();
  });
});

describe("galleryKeys", () => {
  it("given photos > then in their order", () => {
    expect(
      galleryKeys("c.jpg", [
        { id: "2", imageKey: "b.jpg", sortOrder: 1, isCover: 0 },
        { id: "1", imageKey: "a.jpg", sortOrder: 0, isCover: 1 },
      ]),
    ).toEqual(["a.jpg", "b.jpg"]);
  });
  it("given only a cover > then the cover", () => {
    expect(galleryKeys("c.jpg", [])).toEqual(["c.jpg"]);
  });
  it("given nothing > then no photos", () => {
    expect(galleryKeys(null, [])).toEqual([]);
  });
});
