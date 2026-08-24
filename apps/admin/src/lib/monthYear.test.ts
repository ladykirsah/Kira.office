import { describe, expect, it } from "vitest";
import { splitPeriod, joinPeriod, monthNames, displayYear, yearChoices } from "./monthYear";

/**
 * The two boxes that replaced `<input type="month">` (owner, 2026-08-24).
 *
 * The native control was the complaint that started this: "the time setting is un-clickable". It is
 * one field with two invisible halves, its calendar button is a few pixels wide, and it renders
 * whatever the browser feels like — on this machine "August 2026", in English and the western year,
 * directly beside a heading reading สิงหาคม 2569. Two plain dropdowns are obviously clickable, and
 * they can say what the rest of the shop says.
 *
 * The month is still stored and passed around as "YYYY-MM" in the western calendar; พ.ศ. is a
 * display concern only and must never reach the database.
 */
describe("splitPeriod", () => {
  it("given a period > then its year and month as numbers", () => {
    expect(splitPeriod("2026-08")).toEqual({ year: 2026, month: 8 });
    expect(splitPeriod("2026-01")).toEqual({ year: 2026, month: 1 });
    expect(splitPeriod("2026-12")).toEqual({ year: 2026, month: 12 });
  });

  it("given anything malformed > then null, never a half-read date", () => {
    for (const p of ["2026-8", "2026", "26-08", "2026-13", "2026-00", "", "abc"]) {
      expect(splitPeriod(p), p).toBeNull();
    }
  });
});

describe("joinPeriod", () => {
  it("given a year and month > then a zero-padded period", () => {
    expect(joinPeriod(2026, 8)).toBe("2026-08");
    expect(joinPeriod(2026, 12)).toBe("2026-12");
    expect(joinPeriod(2026, 1)).toBe("2026-01");
  });

  it("round-trips with splitPeriod", () => {
    for (let m = 1; m <= 12; m++) {
      expect(splitPeriod(joinPeriod(2026, m))).toEqual({ year: 2026, month: m });
    }
  });
});

describe("monthNames", () => {
  it("given Thai > then the full Thai months, January first", () => {
    const th = monthNames("th");
    expect(th).toHaveLength(12);
    expect(th[0]).toBe("มกราคม");
    expect(th[7]).toBe("สิงหาคม");
    expect(th[11]).toBe("ธันวาคม");
  });

  it("given English > then the full English months", () => {
    const en = monthNames("en");
    expect(en).toHaveLength(12);
    expect(en[0]).toBe("January");
    expect(en[7]).toBe("August");
    expect(en[11]).toBe("December");
  });
});

describe("displayYear", () => {
  it("given Thai > then the Buddhist year, which is what a Thai bill says", () => {
    expect(displayYear(2026, "th")).toBe("2569");
    expect(displayYear(2025, "th")).toBe("2568");
  });

  it("given English > then the year unchanged", () => {
    expect(displayYear(2026, "en")).toBe("2026");
  });

  it("converts for display ONLY — the value stays western", () => {
    // Guards the one mistake that would corrupt data: 2569 must never be what gets stored.
    expect(joinPeriod(2026, 8)).toBe("2026-08");
    expect(displayYear(2026, "th")).not.toBe("2026");
  });
});

describe("yearChoices", () => {
  it("given this year > then a few back and one ahead, newest first", () => {
    // Back far enough to correct an old month, one ahead because a December advance can be taken
    // against January. Not a hundred years of scrolling.
    expect(yearChoices(2026)).toEqual([2027, 2026, 2025, 2024, 2023]);
  });

  it("always contains the year it was given", () => {
    for (const y of [2020, 2026, 2031]) expect(yearChoices(y)).toContain(y);
  });
});
