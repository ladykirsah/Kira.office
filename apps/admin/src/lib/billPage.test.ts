import { describe, it, expect } from "vitest";
import { billPageLayout } from "./billPage";

/** A capture 1000px wide and `ratio`× as tall — the shape the bill came out at. */
const capture = (ratio: number) => ({ width: 1000, height: 1000 * ratio });

describe("billPageLayout", () => {
  it("given a short bill > a portrait A5 page, bill filling its width", () => {
    // 1000 × 675 → at 148mm wide the bill is ~100mm tall, well inside A5's 210mm.
    const out = billPageLayout(capture(0.675));
    expect(out.page).toEqual({ w: 148, h: 210 });
    expect(out.x).toBe(0);
    expect(out.w).toBe(148);
    expect(out.h).toBeCloseTo(99.9, 1);
  });

  it("leaves the rest of a short page blank rather than shrinking the paper", () => {
    const out = billPageLayout(capture(0.4));
    expect(out.page.h).toBe(210); // full A5 height, bill sits at the top
    expect(out.h).toBeLessThan(100);
  });

  it("given a bill too long for A5 > moves to portrait A4, same bill width, centred", () => {
    // 148mm wide → ~250mm tall: past A5's 210mm.
    const out = billPageLayout(capture(1.69));
    expect(out.page).toEqual({ w: 210, h: 297 });
    expect(out.w).toBe(148); // unchanged — a long bill prints the same size as a short one
    expect(out.x).toBeCloseTo(31, 5); // (210 − 148) / 2
    expect(out.h).toBeCloseTo(250.1, 1);
  });

  it("given a bill even too long for A4 > scales it down so nothing is cut off", () => {
    const out = billPageLayout(capture(3));
    expect(out.page).toEqual({ w: 210, h: 297 });
    expect(out.h).toBeLessThanOrEqual(297);
    expect(out.w).toBeLessThan(148);
    expect(out.w / out.h).toBeCloseTo(1 / 3, 5); // proportion kept
    expect(out.x).toBeCloseTo((210 - out.w) / 2, 5);
  });

  it("at exactly A5 height > still A5", () => {
    const out = billPageLayout(capture(210 / 148));
    expect(out.page).toEqual({ w: 148, h: 210 });
  });
});
