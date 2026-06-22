import { describe, it, expect } from "vitest";
import { round2, toSatang, fromSatang } from "./money";

describe("round2 > rounds THB to 2 decimals", () => {
  it("given 2.146 > rounds up to 2.15", () => {
    expect(round2(2.146)).toBe(2.15);
  });
  it("given 2.144 > rounds down to 2.14", () => {
    expect(round2(2.144)).toBe(2.14);
  });
  it("given 100/1.07 > rounds to 93.46", () => {
    expect(round2(100 / 1.07)).toBe(93.46);
  });
  it("given a whole number > unchanged", () => {
    expect(round2(10)).toBe(10);
  });
});

describe("round2 > rounds half away from zero for negatives", () => {
  it("given -2.145 > rounds away from zero to -2.15", () => {
    expect(round2(-2.145)).toBe(-2.15);
  });
  it("given -0.015 > rounds away from zero to -0.02", () => {
    expect(round2(-0.015)).toBe(-0.02);
  });
  it("given -2.144 > rounds toward zero to -2.14", () => {
    expect(round2(-2.144)).toBe(-2.14);
  });
  it("given a negative whole number > unchanged", () => {
    expect(round2(-4)).toBe(-4);
  });
});

describe("toSatang / fromSatang > THB <-> integer minor units", () => {
  it("toSatang(30.51) > 3051 (no float drift)", () => {
    expect(toSatang(30.51)).toBe(3051);
  });
  it("toSatang(107) > 10700", () => {
    expect(toSatang(107)).toBe(10700);
  });
  it("toSatang(0.1) > 10", () => {
    expect(toSatang(0.1)).toBe(10);
  });
  it("toSatang(-12.34) > -1234 (negatives symmetric)", () => {
    expect(toSatang(-12.34)).toBe(-1234);
  });
  it("fromSatang(3051) > 30.51", () => {
    expect(fromSatang(3051)).toBe(30.51);
  });
  it("fromSatang(-1234) > -12.34", () => {
    expect(fromSatang(-1234)).toBe(-12.34);
  });
  it("round-trips THB through satang", () => {
    for (const thb of [30.51, 107, 0.1, 999.99]) {
      expect(fromSatang(toSatang(thb))).toBe(thb);
    }
  });
});
