import { describe, it, expect } from "vitest";
import { formatSalesId, parseSalesId, nextSalesId } from "./salesId";

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
