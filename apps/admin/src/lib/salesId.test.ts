import { describe, it, expect } from "vitest";
import { formatSalesId, parseSalesId, nextSalesId, latestSalesIdForDay } from "./salesId";

const ts = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

describe("formatSalesId", () => {
  it("given a date and seq > pads to DASyyyymm-ddnnn", () => {
    expect(formatSalesId(2026, 7, 1, 1)).toBe("DAS202607-01001");
    expect(formatSalesId(2026, 12, 25, 42)).toBe("DAS202612-25042");
  });

  it("given a seq beyond three digits > does not truncate", () => {
    expect(formatSalesId(2026, 7, 1, 1234)).toBe("DAS202607-011234");
  });
});

describe("parseSalesId", () => {
  it("given a well-formed id > returns its parts", () => {
    expect(parseSalesId("DAS202607-01001")).toEqual({
      prefix: "DAS",
      year: 2026,
      month: 7,
      day: 1,
      seq: 1,
    });
  });

  it("given a malformed id > returns null", () => {
    expect(parseSalesId("nonsense")).toBeNull();
  });
});

describe("nextSalesId", () => {
  it("given no previous id > starts the day at 001", () => {
    expect(nextSalesId(null, ts(2026, 6, 1))).toBe("DAS202607-01001");
  });

  it("given a previous id on the same day > increments the running number", () => {
    expect(nextSalesId("DAS202607-01001", ts(2026, 6, 1))).toBe("DAS202607-01002");
  });

  it("given a previous id from an earlier day > resets to 001", () => {
    expect(nextSalesId("DAS202607-01009", ts(2026, 6, 2))).toBe("DAS202607-02001");
  });

  it("given a previous id from a previous month > resets to 001", () => {
    expect(nextSalesId("DAS202606-30005", ts(2026, 6, 1))).toBe("DAS202607-01001");
  });
});

describe("latestSalesIdForDay", () => {
  const now = ts(2026, 6, 1); // 1 Jul 2026

  it("given ids for today > returns the highest-seq one", () => {
    expect(
      latestSalesIdForDay(["DAS202607-01001", "DAS202607-01003", "DAS202607-01002"], now),
    ).toBe("DAS202607-01003");
  });

  it("given ids only from other days > returns null", () => {
    expect(latestSalesIdForDay(["DAS202606-30009", "DAS202607-02001"], now)).toBeNull();
  });

  it("ignores nulls and malformed ids", () => {
    expect(latestSalesIdForDay([null, "garbage", "DAS202607-01005", undefined], now)).toBe(
      "DAS202607-01005",
    );
  });

  it("given an empty list > returns null", () => {
    expect(latestSalesIdForDay([], now)).toBeNull();
  });

  it("given a prefix > seeds from that series only (QT and DAS are independent)", () => {
    const ids = ["DAS202607-01009", "QT202607-01002", "QT202607-01001"];
    expect(latestSalesIdForDay(ids, now, "QT")).toBe("QT202607-01002");
    expect(latestSalesIdForDay(ids, now, "DAS")).toBe("DAS202607-01009");
  });
});
