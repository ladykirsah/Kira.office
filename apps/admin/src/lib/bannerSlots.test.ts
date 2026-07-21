import { describe, it, expect } from "vitest";
import { SLOT_LIMIT, slotIsFull, slotCountLabel, liveWindow } from "./bannerSlots";

describe("SLOT_LIMIT", () => {
  it("caps the hero carousel at 3 and leaves the promo strip open", () => {
    expect(SLOT_LIMIT.hero).toBe(3);
    expect(SLOT_LIMIT.promo).toBeNull();
  });
});

describe("slotIsFull", () => {
  it("given fewer hero banners than the cap > not full", () => {
    expect(slotIsFull("hero", 2)).toBe(false);
  });

  it("given hero at the cap > full", () => {
    expect(slotIsFull("hero", 3)).toBe(true);
  });

  it("given hero somehow over the cap > still full (never lets a 4th through)", () => {
    // Two tabs open, both adding, could push the count past the cap. Guard with >=, not ===.
    expect(slotIsFull("hero", 4)).toBe(true);
  });

  it("given the uncapped promo strip > never full", () => {
    expect(slotIsFull("promo", 99)).toBe(false);
  });
});

describe("slotCountLabel", () => {
  it("shows used-of-limit for a capped slot", () => {
    expect(slotCountLabel("hero", 2)).toBe("2 / 3");
  });

  it("shows a plain count for an uncapped slot", () => {
    expect(slotCountLabel("promo", 2)).toBe("2");
  });
});

describe("liveWindow", () => {
  it("given Live time OFF > no window at all, so the banner runs until changed", () => {
    // This is the owner's "live until the next change" — both bounds null, not a far-future date.
    expect(liveWindow(false, "2026-08-01T09:00", "2026-08-31T09:00")).toEqual({
      startsAt: null,
      endsAt: null,
    });
  });

  it("given Live time ON > converts both bounds to epoch ms", () => {
    const w = liveWindow(true, "2026-08-01T09:00", "2026-08-31T09:00");
    expect(w.startsAt).toBe(new Date("2026-08-01T09:00").getTime());
    expect(w.endsAt).toBe(new Date("2026-08-31T09:00").getTime());
  });

  it("given Live time ON with only a start > open-ended run from that date", () => {
    expect(liveWindow(true, "2026-08-01T09:00", "").endsAt).toBeNull();
  });

  it("given Live time ON with neither date > behaves like OFF rather than erroring", () => {
    expect(liveWindow(true, "", "")).toEqual({ startsAt: null, endsAt: null });
  });
});
