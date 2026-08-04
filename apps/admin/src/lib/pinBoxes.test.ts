import { describe, it, expect } from "vitest";
import { PIN_LENGTH, boxDigits, setBoxDigit, spreadPaste } from "./pinBoxes";

describe("boxDigits", () => {
  it("lays a value out across six boxes, blanks for the rest", () => {
    expect(boxDigits("481")).toEqual(["4", "8", "1", "", "", ""]);
    expect(boxDigits("")).toEqual(["", "", "", "", "", ""]);
    expect(boxDigits("481920")).toEqual(["4", "8", "1", "9", "2", "0"]);
  });

  it("keeps a hole in the middle where one was cleared", () => {
    expect(boxDigits("48 920")).toEqual(["4", "8", "", "9", "2", "0"]);
  });
});

describe("setBoxDigit", () => {
  it("puts a digit in its own box", () => {
    expect(setBoxDigit("48", 2, "1")).toBe("481");
  });

  it("replaces rather than inserting", () => {
    expect(setBoxDigit("481920", 0, "7")).toBe("781920");
    expect(setBoxDigit("481920", 5, "7")).toBe("481927");
  });

  it("clearing a middle box leaves a hole — the later digits DO NOT shift left", () => {
    // The bug this test exists for: "481920" minus the third digit must not become "48920",
    // which would silently move 9, 2 and 0 into the wrong boxes on screen.
    expect(setBoxDigit("481920", 2, "")).toBe("48 920");
  });

  it("clearing from the end leaves nothing trailing", () => {
    expect(setBoxDigit("481920", 5, "")).toBe("48192");
    expect(setBoxDigit("4", 0, "")).toBe("");
  });

  it("a value with a hole is never a complete PIN", () => {
    const holed = setBoxDigit("481920", 2, "");
    expect(/^\d{6}$/.test(holed)).toBe(false);
  });
});

describe("spreadPaste", () => {
  it("a pasted PIN fills every box", () => {
    expect(spreadPaste("481920")).toBe("481920");
  });

  it("ignores whatever isn't a digit, and anything past six", () => {
    expect(spreadPaste("48-19-20")).toBe("481920");
    expect(spreadPaste("4819201234")).toBe("481920");
    expect(spreadPaste("PIN: 481 920")).toBe("481920");
  });

  it("the length is the one the boxes use", () => {
    expect(PIN_LENGTH).toBe(6);
  });
});
