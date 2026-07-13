import { describe, it, expect } from "vitest";
import { mmss } from "./format";

describe("mmss > countdown label m:ss", () => {
  it("pads seconds to two digits", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(5)).toBe("0:05");
    expect(mmss(59)).toBe("0:59");
  });

  it("rolls seconds into minutes", () => {
    expect(mmss(60)).toBe("1:00");
    expect(mmss(65)).toBe("1:05");
    expect(mmss(300)).toBe("5:00");
  });

  it("floors fractional seconds", () => {
    expect(mmss(9.9)).toBe("0:09");
  });

  it("clamps negatives to zero", () => {
    expect(mmss(-3)).toBe("0:00");
  });
});
