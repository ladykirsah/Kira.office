import { describe, it, expect } from "vitest";
import { thaiShortDate, monthLabel } from "./dayOff";

describe("thaiShortDate", () => {
  it("given an ISO day > then Thai month and a Buddhist-era year", () => {
    // The shop reads dates in BE; 2026 CE is 2569 BE, shown as its last two digits like a bill date.
    expect(thaiShortDate("2026-08-14")).toBe("14 ส.ค. 69");
  });

  it("given January > then ม.ค., and no leading zero on the day", () => {
    expect(thaiShortDate("2026-01-09")).toBe("9 ม.ค. 69");
  });

  it("given a year that rolls the BE century > then still two digits", () => {
    expect(thaiShortDate("2057-12-31")).toBe("31 ธ.ค. 00");
  });

  it("given junk > then an em dash rather than 'NaN undefined NaN'", () => {
    // These strings come from the database; a malformed one must not render as debris in a table.
    for (const bad of ["", "not-a-date", "2026-13-40x"]) expect(thaiShortDate(bad)).toBe("—");
  });
});

describe("monthLabel", () => {
  it("given a YYYY-MM > then the Thai month and BE year in full", () => {
    expect(monthLabel("2026-08")).toBe("สิงหาคม 2569");
  });

  it("given junk > then an em dash", () => {
    expect(monthLabel("nope")).toBe("—");
  });
});
