import { describe, it, expect } from "vitest";
import { flashScarcity } from "./flashScarcity";

describe("flashScarcity", () => {
  it("given no campaign stock cap > then there is no bar", () => {
    expect(flashScarcity(null)).toBeNull();
    expect(flashScarcity({ stockCap: null, soldCount: 4 })).toBeNull();
    expect(flashScarcity({ stockCap: 0, soldCount: 0 })).toBeNull();
  });

  it("given 7 of 10 sold > then 70% sold and 3 left", () => {
    expect(flashScarcity({ stockCap: 10, soldCount: 7 })).toEqual({ soldPct: 70, remaining: 3 });
  });

  it("given 97 of 100 sold > then never rounds up to 100%", () => {
    expect(flashScarcity({ stockCap: 100, soldCount: 99.6 })?.soldPct).toBe(99);
    expect(flashScarcity({ stockCap: 100, soldCount: 97 })?.soldPct).toBe(97);
  });

  it("given the cap is used up (or oversold) > then 100% and nothing left", () => {
    expect(flashScarcity({ stockCap: 5, soldCount: 5 })).toEqual({ soldPct: 100, remaining: 0 });
    expect(flashScarcity({ stockCap: 5, soldCount: 8 })).toEqual({ soldPct: 100, remaining: 0 });
  });
});
