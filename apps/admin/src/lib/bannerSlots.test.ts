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
  it("given always-live ON > no window at all, so the banner runs forever until changed", () => {
    // The owner's "shown forever" — both bounds null, not a far-future date.
    expect(liveWindow(true, 111, 222)).toEqual({ startsAt: null, endsAt: null });
  });

  it("given always-live OFF (scheduled) > passes the resolved bounds through", () => {
    expect(liveWindow(false, 111, 222)).toEqual({ startsAt: 111, endsAt: 222 });
  });

  it("given scheduled with only a start > open-ended run from that date", () => {
    expect(liveWindow(false, 111, null)).toEqual({ startsAt: 111, endsAt: null });
  });

  it("given scheduled with neither date > both null (no bound)", () => {
    expect(liveWindow(false, null, null)).toEqual({ startsAt: null, endsAt: null });
  });
});
