import { describe, it, expect } from "vitest";
import { productDisplayName } from "./productLabel";

describe("productDisplayName", () => {
  it("given a brand > joins name and brand with ' · '", () => {
    expect(productDisplayName("Compressor", "Denso")).toBe("Compressor · Denso");
  });

  it("given no brand (null/undefined/empty/blank) > shows just the name", () => {
    expect(productDisplayName("Cabin filter", null)).toBe("Cabin filter");
    expect(productDisplayName("Cabin filter", undefined)).toBe("Cabin filter");
    expect(productDisplayName("Cabin filter", "")).toBe("Cabin filter");
    expect(productDisplayName("Cabin filter", "  ")).toBe("Cabin filter");
  });
});
