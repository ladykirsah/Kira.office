import { describe, it, expect } from "vitest";
import { formatDateTime, mmss } from "./format";

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

/**
 * Bug hunt 15 Nov 2026: the account orders page is drawn on the server, which runs on UTC, so a
 * Thai customer saw their order 7 hours early — and a late-night order on the day before. AirPlus
 * sells in Thailand: times are Bangkok time wherever the page is drawn.
 */
describe("formatDateTime > always Bangkok time", () => {
  it("given an order at 00:30 in Bangkok > then that day and time, not the UTC one", () => {
    expect(formatDateTime(Date.UTC(2026, 10, 15, 17, 30))).toBe("16/11/2026 · 00:30");
  });

  it("given an afternoon order > then the Bangkok hour", () => {
    expect(formatDateTime(Date.UTC(2026, 0, 31, 8, 5))).toBe("31/01/2026 · 15:05");
  });
});
