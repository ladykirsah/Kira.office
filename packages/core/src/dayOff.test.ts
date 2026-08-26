import { describe, it, expect } from "vitest";
import {
  LEAVE_MODES,
  isLeaveHalves,
  leaveModeLabel,
  leaveModePhrase,
  daysOffLabel,
  summariseDaysOff,
  bangkokMonth,
} from "./dayOff";

describe("LEAVE_MODES", () => {
  it("is the owner's three, heaviest first (5 Aug 2026)", () => {
    expect(LEAVE_MODES.map((m) => [m.halves, m.th])).toEqual([
      [2, "เต็มวัน"],
      [1, "ครึ่งวัน"],
      [0, "เข้าสาย"],
    ]);
  });

  it("prices เข้าสาย at zero halves — the person worked, so the wage is untouched", () => {
    // The whole reason it can live in the same dropdown as the two that DO cost money: payroll
    // already subtracts `halves`, so 0 subtracts nothing and no wage arithmetic changes.
    expect(LEAVE_MODES.find((m) => m.th === "เข้าสาย")?.halves).toBe(0);
  });
});

describe("isLeaveHalves", () => {
  it("accepts the three the dropdown offers", () => {
    expect([0, 1, 2].every(isLeaveHalves)).toBe(true);
  });

  it("rejects anything else, so a hand-rolled POST cannot invent a leave mode", () => {
    // The endpoint is authenticated but not trusted: `halves` goes straight into payroll, so a 4
    // here would quietly wipe two days of someone's wage.
    for (const bad of [3, -1, 0.5, "2", null, undefined, NaN, Infinity]) {
      expect(isLeaveHalves(bad)).toBe(false);
    }
  });
});

describe("leaveModeLabel", () => {
  it("names each mode in Thai", () => {
    expect(leaveModeLabel(2)).toBe("เต็มวัน");
    expect(leaveModeLabel(1)).toBe("ครึ่งวัน");
    expect(leaveModeLabel(0)).toBe("เข้าสาย");
  });
});

describe("daysOffLabel", () => {
  it("given whole days > then counts days", () => {
    expect(daysOffLabel(4)).toBe("2 วัน");
  });

  it("given an odd number of halves > then adds ครึ่ง", () => {
    expect(daysOffLabel(5)).toBe("2 วันครึ่ง");
  });

  it("given a single half > then just ครึ่งวัน, not '0 วันครึ่ง'", () => {
    expect(daysOffLabel(1)).toBe("ครึ่งวัน");
  });

  it("given nothing > then an empty string for the caller to handle", () => {
    expect(daysOffLabel(0)).toBe("");
  });
});

describe("summariseDaysOff", () => {
  const rows = (...halves: number[]) => halves.map((h) => ({ halves: h }));

  it("given two full days and a half > then 2 วันครึ่ง", () => {
    expect(summariseDaysOff(rows(2, 2, 1)).offHalves).toBe(5);
    expect(summariseDaysOff(rows(2, 2, 1)).label).toBe("หยุดไปแล้ว 2 วันครึ่ง");
  });

  it("given lateness > then it is counted SEPARATELY, never added to the days off", () => {
    // Folding เข้าสาย into the same total would overstate what the month lost: it costs nothing,
    // so a month with three late arrivals and no leave must not read as time taken off.
    const s = summariseDaysOff(rows(2, 0, 0, 0));
    expect(s.offHalves).toBe(2);
    expect(s.lateCount).toBe(3);
    expect(s.label).toBe("หยุดไปแล้ว 1 วัน · เข้าสาย 3 ครั้ง");
  });

  it("given only lateness > then it says so rather than claiming a day off", () => {
    const s = summariseDaysOff(rows(0, 0));
    expect(s.offHalves).toBe(0);
    expect(s.label).toBe("ยังไม่มีวันหยุด · เข้าสาย 2 ครั้ง");
  });

  it("given an empty month > then a plain line, not a zero", () => {
    expect(summariseDaysOff([])).toEqual({
      offHalves: 0,
      lateCount: 0,
      label: "ยังไม่มีวันหยุด",
    });
  });
});

describe("bangkokMonth", () => {
  const at = (s: string) => Date.parse(`${s}+07:00`);

  it("given a Bangkok instant > then its YYYY-MM", () => {
    expect(bangkokMonth(at("2026-08-05T14:00:00"))).toBe("2026-08");
  });

  it("given 01:00 on the 1st > then the NEW month, not the UTC one", () => {
    // The Worker's clock is UTC, where that instant is still 18:00 on the last day of July. A month
    // derived from it would list the new month's first submissions under the old month and they
    // would appear to vanish.
    expect(bangkokMonth(at("2026-08-01T01:00:00"))).toBe("2026-08");
  });

  it("given the last hour of a month > then still that month", () => {
    expect(bangkokMonth(at("2026-08-31T23:30:00"))).toBe("2026-08");
  });

  it("given January > then it pads the month to two digits", () => {
    expect(bangkokMonth(at("2026-01-09T09:00:00"))).toBe("2026-01");
  });
});

/**
 * THE SAME SENTENCES, IN ENGLISH (owner, 2026-08-26: the back office reads both).
 *
 * The Thai forms above are unchanged and stay the default, because `leaveModeLabel` is also what the
 * API writes into the activity log — a stored record cannot depend on who reads it later.
 */
describe("daysOffLabel, in English", () => {
  it("counts whole days", () => {
    expect(daysOffLabel(4, "en")).toBe("2 days");
    expect(daysOffLabel(2, "en")).toBe("1 day");
  });

  it("says the half", () => {
    expect(daysOffLabel(5, "en")).toBe("2½ days");
    expect(daysOffLabel(1, "en")).toBe("half a day");
  });

  /** Nothing taken is a different statement from a measured zero — the caller words that itself. */
  it("given nothing taken > then nothing said, in either language", () => {
    expect(daysOffLabel(0, "en")).toBe("");
    expect(daysOffLabel(0, "th")).toBe("");
  });
});

describe("summariseDaysOff, in English", () => {
  const rows = (...halves: number[]) => halves.map((h) => ({ halves: h }));

  it("reads as one sentence", () => {
    expect(summariseDaysOff(rows(2, 2, 1), "en").label).toBe("2½ days taken");
  });

  it("counts lateness separately, because it is never priced", () => {
    expect(summariseDaysOff(rows(2, 0, 0), "en").label).toBe("1 day taken · late 2×");
  });

  it("given a month with nothing in it > then says so", () => {
    expect(summariseDaysOff([], "en").label).toBe("no days off yet");
  });

  /** The numbers are the same sentence either way — only the words around them move. */
  it("counts identically whichever language it is read in", () => {
    const th = summariseDaysOff(rows(2, 1, 0), "th");
    const en = summariseDaysOff(rows(2, 1, 0), "en");
    expect(en.offHalves).toBe(th.offHalves);
    expect(en.lateCount).toBe(th.lateCount);
  });
});

describe("leaveModePhrase", () => {
  it("hands back both languages, for a screen to choose from", () => {
    expect(leaveModePhrase(2)).toEqual({ th: "เต็มวัน", en: "Full day" });
    expect(leaveModePhrase(0)).toEqual({ th: "เข้าสาย", en: "Late" });
  });
});
