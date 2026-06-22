import { describe, it, expect } from "vitest";
import { round2 } from "./money";

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
