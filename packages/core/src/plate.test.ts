import { describe, expect, it } from "vitest";
import { canonicalPlate, plateKey } from "./plate";

describe("canonicalPlate", () => {
  it("given a car plate typed with no space, extra spaces or a dash > then letters, one space, numbers", () => {
    for (const typed of ["กข1234", "กข 1234", "กข   1234", " กข-1234 ", "กข - 1234"]) {
      expect(canonicalPlate(typed)).toBe("กข 1234");
    }
  });

  it("given a plate that starts with a number > then the number stays with the letters", () => {
    expect(canonicalPlate("1กก1234")).toBe("1กก 1234");
    expect(canonicalPlate("1 กก 1234")).toBe("1กก 1234");
    expect(canonicalPlate("12กข 9")).toBe("12กข 9");
  });

  it("given a truck or bus plate (2 digits, 4 digits) > then it keeps the dash", () => {
    expect(canonicalPlate("701234")).toBe("70-1234");
    expect(canonicalPlate("70 - 1234")).toBe("70-1234");
    expect(canonicalPlate("70-1234")).toBe("70-1234");
  });

  it("given anything else > then it is kept as typed, with only the spaces tidied", () => {
    expect(canonicalPlate("  ป้ายแดง   A 123 ")).toBe("ป้ายแดง A 123");
    expect(canonicalPlate("")).toBe("");
  });
});

describe("plateKey", () => {
  it("gives the same key however the plate was typed", () => {
    expect(plateKey("กข 1234")).toBe("กข1234");
    expect(plateKey(" กข-1234")).toBe("กข1234");
    expect(plateKey("70 - 1234")).toBe("701234");
  });
});
