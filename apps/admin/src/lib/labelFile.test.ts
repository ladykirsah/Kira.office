import { describe, it, expect } from "vitest";
import { shippingLabelFileName } from "./labelFile";
import { safeFileStem } from "./htmlCapture";

describe("shippingLabelFileName", () => {
  it("names the file after the order reference the operator is looking for", () => {
    expect(shippingLabelFileName("pdf", "AP-1042")).toBe("label-AP-1042.pdf");
    expect(shippingLabelFileName("png", "AP-1042")).toBe("label-AP-1042.png");
  });

  it("keeps the name safe for a file system", () => {
    expect(shippingLabelFileName("pdf", "AP 2026/07 1042")).toBe("label-AP-2026-07-1042.pdf");
  });

  it("given an empty reference > still returns a usable name", () => {
    expect(shippingLabelFileName("png", "   ")).toBe("label.png");
  });
});

describe("safeFileStem", () => {
  it("collapses the characters a file system will not take", () => {
    expect(safeFileStem('a/b\\c:d*e?f"g<h>i|j k')).toBe("a-b-c-d-e-f-g-h-i-j-k");
  });

  it("does not leave a leading or trailing separator", () => {
    expect(safeFileStem(" /weird/ ")).toBe("weird");
  });

  it("leaves Thai alone — the shop name and product names are Thai", () => {
    expect(safeFileStem("คอมเพรสเซอร์")).toBe("คอมเพรสเซอร์");
  });
});
