import { describe, it, expect } from "vitest";
import {
  buildLabelItem,
  fitmentLines,
  labelDimensions,
  labelFileName,
  sizeHint,
  wrapLines,
} from "./labelForm";

/** Stand-in for canvas text measuring: every character is 10 wide. */
const measure = (s: string) => [...s].length * 10;

const product = { id: "p1", code: "CMP-10S17C", name: "คอมเพรสเซอร์ DENSO 10S17C" };

describe("labelDimensions", () => {
  it("given size L > is 50 mm tall; given S > 35 mm tall", () => {
    expect(labelDimensions("full", "L").h).toBe(50);
    expect(labelDimensions("full", "S").h).toBe(35);
    expect(labelDimensions("minimal", "L").h).toBe(50);
    expect(labelDimensions("minimal", "S").h).toBe(35);
  });

  it("given the full version > widens to the locked 620:294 proportion", () => {
    // 50 × 620/294 = 105.44… → 105.4
    expect(labelDimensions("full", "L").w).toBe(105.4);
    expect(labelDimensions("full", "S").w).toBe(73.8);
  });

  it("given the minimal version > widens to the locked 632:212 proportion", () => {
    // 50 × 632/212 = 149.05… → 149.1
    expect(labelDimensions("minimal", "L").w).toBe(149.1);
    expect(labelDimensions("minimal", "S").w).toBe(104.3);
  });
});

describe("sizeHint", () => {
  it("states the printed height — the only dimension the user picks", () => {
    expect(sizeHint("L")).toBe("50 mm tall");
    expect(sizeHint("S")).toBe("35 mm tall");
  });
});

describe("fitmentLines", () => {
  it("given brand, model and one year > renders 'Brand Model Year'", () => {
    expect(
      fitmentLines([{ carBrand: "Ford", carModel: "Ranger", yearFrom: 2011, yearTo: null }]),
    ).toEqual(["Ford Ranger 2011"]);
  });

  it("given a year range > renders 'from–to'", () => {
    expect(
      fitmentLines([{ carBrand: "Mazda", carModel: "BT-50", yearFrom: 2012, yearTo: 2018 }]),
    ).toEqual(["Mazda BT-50 2012–2018"]);
  });

  it("given the same year twice > renders it once", () => {
    expect(
      fitmentLines([{ carBrand: "Ford", carModel: "Everest", yearFrom: 2015, yearTo: 2015 }]),
    ).toEqual(["Ford Everest 2015"]);
  });

  it("given a fitment with no brand, model or year > skips it", () => {
    expect(
      fitmentLines([
        { carBrand: null, carModel: null, yearFrom: null, yearTo: null },
        { carBrand: "Toyota", carModel: null, yearFrom: null, yearTo: null },
      ]),
    ).toEqual(["Toyota"]);
  });

  it("given more than three fitments > keeps the first three", () => {
    const many = ["A", "B", "C", "D"].map((b) => ({
      carBrand: b,
      carModel: "X",
      yearFrom: null,
      yearTo: null,
    }));
    expect(fitmentLines(many)).toEqual(["A X", "B X", "C X"]);
  });
});

describe("wrapLines", () => {
  it("given text with spaces > breaks between words, not inside them", () => {
    // 10 chars per line: "Compressor" fits, "Assembly" starts the next line.
    expect(wrapLines(measure, "Compressor Assembly", 100, 2)).toEqual(["Compressor", "Assembly"]);
  });

  it("given a word longer than the line > breaks inside that word", () => {
    expect(wrapLines(measure, "ABCDEFGHIJKLMN", 100, 2)).toEqual(["ABCDEFGHIJ", "KLMN"]);
  });

  it("given Thai (no spaces) > still fills each line", () => {
    expect(wrapLines(measure, "คอมเพรสเซอร์", 50, 3)).toEqual(["คอมเพ", "รสเซอ", "ร์"]);
  });

  it("given more text than fits > ellipsizes the last line", () => {
    expect(wrapLines(measure, "one two three four five", 100, 2)).toEqual([
      "one two",
      "three fou…",
    ]);
  });

  it("given text that fits > returns it as one line", () => {
    expect(wrapLines(measure, "Radiator", 100, 2)).toEqual(["Radiator"]);
  });
});

describe("labelFileName", () => {
  it("names the file after the product code, version and size", () => {
    expect(labelFileName("261470-0290", "full", "L")).toBe("label-261470-0290-full-L.png");
    expect(labelFileName("447220-4052", "minimal", "S")).toBe("label-447220-4052-minimal-S.png");
  });

  it("given a code with spaces or slashes > keeps the name filesystem-safe", () => {
    expect(labelFileName("SKN CREAM/50", "full", "L")).toBe("label-SKN-CREAM-50-full-L.png");
  });

  it("given no code > still returns a usable name", () => {
    expect(labelFileName("", "minimal", "S")).toBe("label-minimal-S.png");
  });
});

describe("buildLabelItem", () => {
  it("given a version and size > carries them plus the printed dimensions", () => {
    const item = buildLabelItem(product, "full", "L", 24);
    expect(item).toMatchObject({ version: "full", size: "L", w: 105.4, h: 50, amount: 24 });
  });

  it("given the minimal version > uses the minimal proportion", () => {
    expect(buildLabelItem(product, "minimal", "S", 1)).toMatchObject({ w: 104.3, h: 35 });
  });

  it("given a fractional amount > rounds to a whole number", () => {
    expect(buildLabelItem(product, "full", "L", 2.7).amount).toBe(3);
  });

  it("given an amount below 1 or NaN > clamps to at least 1", () => {
    expect(buildLabelItem(product, "full", "L", 0).amount).toBe(1);
    expect(buildLabelItem(product, "full", "L", -5).amount).toBe(1);
    expect(buildLabelItem(product, "full", "L", NaN).amount).toBe(1);
  });

  it("passes the product through by reference, not a copy", () => {
    expect(buildLabelItem(product, "full", "L", 10).product).toBe(product);
  });
});
