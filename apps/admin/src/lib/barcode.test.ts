import { describe, it, expect } from "vitest";
import { chooseBarcodeFormat } from "./barcode";

describe("chooseBarcodeFormat", () => {
  it("given an empty or whitespace value > returns null (nothing to preview)", () => {
    expect(chooseBarcodeFormat("")).toBeNull();
    expect(chooseBarcodeFormat("   ")).toBeNull();
  });

  it("given 13 digits > returns EAN13", () => {
    expect(chooseBarcodeFormat("8850001234567")).toBe("EAN13");
    expect(chooseBarcodeFormat("  8850001234567  ")).toBe("EAN13");
  });

  it("given a non-13-digit or alphanumeric value > returns CODE128", () => {
    expect(chooseBarcodeFormat("12345")).toBe("CODE128");
    expect(chooseBarcodeFormat("885000123456")).toBe("CODE128"); // 12 digits
    expect(chooseBarcodeFormat("ABC-123")).toBe("CODE128");
  });
});
