import { describe, it, expect } from "vitest";
import { satangToThb, formatBaht, formatBahtTrim, formatUpdatedAt } from "./format";

describe("formatUpdatedAt", () => {
  it("formats a timestamp as DD/MM/YYYY · HH:MM in local 24-hour time", () => {
    const ms = new Date(2026, 5, 23, 14, 30).getTime(); // 23 Jun 2026, 14:30 local
    expect(formatUpdatedAt(ms)).toBe("23/06/2026 · 14:30");
  });

  it("zero-pads day, month, hour and minute", () => {
    const ms = new Date(2026, 0, 5, 9, 7).getTime(); // 05 Jan 2026, 09:07 local
    expect(formatUpdatedAt(ms)).toBe("05/01/2026 · 09:07");
  });
});

describe("satang display helpers", () => {
  it("satangToThb formats integer satang as THB", () => {
    expect(satangToThb(10700)).toBe("107.00");
    expect(satangToThb(0)).toBe("0.00");
    expect(satangToThb(5)).toBe("0.05");
  });

  it("formatBaht prefixes ฿", () => {
    expect(formatBaht(10700)).toBe("฿107.00");
  });

  it("formatBahtTrim drops decimals for whole baht", () => {
    expect(formatBahtTrim(289000)).toBe("฿2890");
    expect(formatBahtTrim(10700)).toBe("฿107");
    expect(formatBahtTrim(0)).toBe("฿0");
  });

  it("formatBahtTrim keeps two decimals when there are satang", () => {
    expect(formatBahtTrim(289050)).toBe("฿2890.50");
    expect(formatBahtTrim(5)).toBe("฿0.05");
  });
});
