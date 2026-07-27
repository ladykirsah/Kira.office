import { describe, it, expect } from "vitest";
import { buildLabelItem, sizeHint } from "./labelForm";

const product = { id: "p1", code: "CMP-10S17C", name: "คอมเพรสเซอร์ DENSO 10S17C" };

describe("buildLabelItem", () => {
  it("given size M > uses the M preset dimensions (50 × 30)", () => {
    const item = buildLabelItem(product, "M", true, 24);
    expect(item.w).toBe(50);
    expect(item.h).toBe(30);
  });

  it("given size S or L > uses those preset dimensions", () => {
    expect(buildLabelItem(product, "S", true, 1)).toMatchObject({ w: 32, h: 25 });
    expect(buildLabelItem(product, "L", true, 1)).toMatchObject({ w: 70, h: 40 });
  });

  it("given a fractional amount > rounds to a whole number", () => {
    expect(buildLabelItem(product, "M", true, 2.7).amount).toBe(3);
  });

  it("given an amount below 1 or NaN > clamps to at least 1", () => {
    expect(buildLabelItem(product, "M", true, 0).amount).toBe(1);
    expect(buildLabelItem(product, "M", true, -5).amount).toBe(1);
    expect(buildLabelItem(product, "M", true, NaN).amount).toBe(1);
  });

  it("carries the barcode choice and the product through unchanged", () => {
    const withBarcode = buildLabelItem(product, "M", true, 10);
    const titleOnly = buildLabelItem(product, "M", false, 10);
    expect(withBarcode.showBarcode).toBe(true);
    expect(titleOnly.showBarcode).toBe(false);
    // the product is passed through by reference, not copied
    expect(withBarcode.product).toBe(product);
  });
});

describe("sizeHint", () => {
  it("formats a size key as 'W × H mm'", () => {
    expect(sizeHint("M")).toBe("50 × 30 mm");
    expect(sizeHint("L")).toBe("70 × 40 mm");
    expect(sizeHint("S")).toBe("32 × 25 mm");
  });
});
