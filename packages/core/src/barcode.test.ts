import { describe, it, expect } from "vitest";
import { deriveBarcodeFromProductId, resolveProductBarcode } from "./barcode";

describe("deriveBarcodeFromProductId", () => {
  it("given a product id > returns it verbatim as the barcode value", () => {
    expect(deriveBarcodeFromProductId("9700-0124-00")).toBe("9700-0124-00");
    expect(deriveBarcodeFromProductId("443440-0860")).toBe("443440-0860");
    expect(deriveBarcodeFromProductId("AC-CMP-VIOS14")).toBe("AC-CMP-VIOS14");
  });

  it("given surrounding whitespace > trims it", () => {
    expect(deriveBarcodeFromProductId("  9700-0124-00  ")).toBe("9700-0124-00");
  });

  it("given an empty or whitespace-only id > throws", () => {
    expect(() => deriveBarcodeFromProductId("")).toThrow(/product id/i);
    expect(() => deriveBarcodeFromProductId("   ")).toThrow(/product id/i);
  });
});

describe("resolveProductBarcode", () => {
  it("given an existing scanned/manufacturer barcode > keeps it (never overwrites)", () => {
    // Real Thai retail EAN-13 that is NOT the product id — must be preserved.
    expect(
      resolveProductBarcode({ productId: "AC-CMP-VIOS14", scannedBarcode: "8851001000013" }),
    ).toBe("8851001000013");
  });

  it("given a scanned barcode with whitespace > keeps it trimmed", () => {
    expect(resolveProductBarcode({ productId: "X", scannedBarcode: "  885100  " })).toBe("885100");
  });

  it("given no barcode > derives one from the product id", () => {
    expect(resolveProductBarcode({ productId: "AC-CMP-VIOS14", scannedBarcode: "" })).toBe(
      "AC-CMP-VIOS14",
    );
    expect(resolveProductBarcode({ productId: "443440-0860", scannedBarcode: null })).toBe(
      "443440-0860",
    );
    expect(resolveProductBarcode({ productId: "9700-0124-00" })).toBe("9700-0124-00");
  });

  it("given a whitespace-only barcode > treats it as missing and derives from the product id", () => {
    expect(resolveProductBarcode({ productId: "9700-0124-00", scannedBarcode: "   " })).toBe(
      "9700-0124-00",
    );
  });

  it("given neither a barcode nor a product id > throws (no source for a barcode)", () => {
    expect(() => resolveProductBarcode({ productId: "", scannedBarcode: "" })).toThrow(
      /product id/i,
    );
  });
});
