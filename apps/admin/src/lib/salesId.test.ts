import { describe, it, expect } from "vitest";
import { formatSalesId, parseSalesId, nextSalesId } from "./salesId";

const ts = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

describe("formatSalesId", () => {
  it("given a month and seq > pads to DAS-YYYY-MM-NNNN", () => {
    expect(formatSalesId(2026, 1, 42)).toBe("DAS-2026-01-0042");
    expect(formatSalesId(2026, 12, 7)).toBe("DAS-2026-12-0007");
  });

  it("given a seq beyond four digits > does not truncate", () => {
    expect(formatSalesId(2026, 1, 12345)).toBe("DAS-2026-01-12345");
  });
});

describe("parseSalesId", () => {
  it("given a well-formed id > returns its parts", () => {
    expect(parseSalesId("DAS-2026-01-0042")).toEqual({
      prefix: "DAS",
      year: 2026,
      month: 1,
      seq: 42,
    });
  });

  it("given a malformed id > returns null", () => {
    expect(parseSalesId("nonsense")).toBeNull();
  });
});

describe("nextSalesId", () => {
  it("given no previous id > starts the month at 0001", () => {
    expect(nextSalesId(null, ts(2026, 6, 17))).toBe("DAS-2026-07-0001");
  });

  it("given a previous id in the same month > increments the running number", () => {
    expect(nextSalesId("DAS-2026-07-0001", ts(2026, 6, 17))).toBe("DAS-2026-07-0002");
  });

  it("given a previous id from an earlier month > resets to 0001", () => {
    expect(nextSalesId("DAS-2026-06-0042", ts(2026, 6, 17))).toBe("DAS-2026-07-0001");
  });

  it("given a previous id from an earlier year > resets to 0001", () => {
    expect(nextSalesId("DAS-2025-07-0100", ts(2026, 6, 17))).toBe("DAS-2026-07-0001");
  });
});
