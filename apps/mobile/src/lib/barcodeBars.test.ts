import { describe, expect, it } from "vitest";
import { barRuns, barcodeBars } from "./barcodeBars";

describe("barRuns", () => {
  it("given modules > then touching black modules become one bar, gaps are skipped", () => {
    expect(barRuns("1101110")).toEqual([
      { start: 0, length: 2 },
      { start: 3, length: 3 },
    ]);
  });

  it("given no black modules > then there are no bars", () => {
    expect(barRuns("000")).toEqual([]);
  });
});

describe("barcodeBars", () => {
  it("given 13 digits with a good check digit > then it draws an EAN-13 of 95 modules", () => {
    const bars = barcodeBars("8851234567898");
    expect(bars?.format).toBe("EAN13");
    expect(bars?.bits).toHaveLength(95);
    expect(bars?.bits.startsWith("101")).toBe(true);
  });

  it("given letters or symbols > then it draws Code 128, which takes any value", () => {
    const bars = barcodeBars("TY-VIGO-08");
    expect(bars?.format).toBe("CODE128");
    expect(bars?.bits.endsWith("1100011101011")).toBe(true);
  });

  it("given 13 digits with a bad check digit > then it still draws, as Code 128", () => {
    expect(barcodeBars("8851234567890")?.format).toBe("CODE128");
  });

  it("given Thai letters, which no barcode can carry > then there is nothing to draw", () => {
    expect(barcodeBars("สมชาย")).toBeNull();
  });

  it("given nothing > then there is nothing to draw", () => {
    expect(barcodeBars("   ")).toBeNull();
  });
});
