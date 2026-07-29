import { describe, it, expect } from "vitest";
import { billFileName } from "./billFile";

describe("billFileName", () => {
  it("names the file after the bill number", () => {
    expect(billFileName("pdf", { saleNumber: "DAS202607-29001", plate: "1กท1111" })).toBe(
      "bill-DAS202607-29001.pdf",
    );
  });

  it("given no bill number yet > falls back to the plate", () => {
    expect(billFileName("png", { saleNumber: "", plate: "1กท1111" })).toBe("bill-1กท1111.png");
  });

  it("given neither > still returns a usable name", () => {
    expect(billFileName("pdf", { saleNumber: "", plate: "  " })).toBe("bill.pdf");
  });

  it("keeps the name safe for a file system", () => {
    expect(billFileName("png", { saleNumber: "DAS 2026/07 001", plate: "" })).toBe(
      "bill-DAS-2026-07-001.png",
    );
  });
});
