import { describe, it, expect } from "vitest";
import { satangToThb, formatBaht } from "./format";

describe("satang display helpers", () => {
  it("satangToThb formats integer satang as THB", () => {
    expect(satangToThb(10700)).toBe("107.00");
    expect(satangToThb(0)).toBe("0.00");
    expect(satangToThb(5)).toBe("0.05");
  });

  it("formatBaht prefixes ฿", () => {
    expect(formatBaht(10700)).toBe("฿107.00");
  });
});
