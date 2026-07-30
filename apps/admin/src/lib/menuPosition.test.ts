import { describe, it, expect } from "vitest";
import { menuPosition, type Rect } from "./menuPosition";

/**
 * Row "Action" menus live inside the table's `overflow-x: auto` scroller. CSS collapses
 * `overflow-y` to `auto` alongside it, so an absolutely-positioned menu on the LAST row gets
 * clipped by the frame instead of overhanging it. The fix renders the menu fixed-positioned in a
 * portal, which makes these coordinates the whole behaviour — if they are wrong the menu lands
 * off-screen or on top of the button, and no type checker will notice.
 */
const VIEWPORT = { width: 1000, height: 800 };
const MENU_H = 100;

/** A button comfortably mid-viewport. */
const MID: Rect = { top: 300, bottom: 332, left: 500, right: 620 };
/** A button on the last table row, near the viewport floor. */
const LOW: Rect = { top: 740, bottom: 772, left: 500, right: 620 };

describe("menuPosition > vertical placement", () => {
  it("given room below the button > opens downward just under it", () => {
    expect(menuPosition(MID, VIEWPORT, MENU_H).top).toBe(336); // 332 + 4px gap
  });

  it("given the button sits too low to fit the menu below > flips above it", () => {
    // below would end at 776 + 100 = 876, past the 800px floor
    expect(menuPosition(LOW, VIEWPORT, MENU_H).top).toBe(636); // 740 - 4 - 100
  });

  it("given the menu fits below by exactly one pixel > still opens downward", () => {
    // bottom 332 + 4 gap + height = exactly 800
    expect(menuPosition(MID, VIEWPORT, 464).top).toBe(336);
  });

  it("given the menu fits neither below nor above > stays on screen", () => {
    const p = menuPosition(MID, VIEWPORT, 5000);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeLessThan(VIEWPORT.height);
  });
});

describe("menuPosition > horizontal placement", () => {
  it("right-aligns the menu to the button (mirroring the CSS `right: 0`)", () => {
    expect(menuPosition(MID, VIEWPORT, MENU_H).right).toBe(380); // 1000 - 620
  });

  it("given a button flush to the right edge > never pushes the menu off screen", () => {
    const flush: Rect = { top: 300, bottom: 332, left: 900, right: 1000 };
    expect(menuPosition(flush, VIEWPORT, MENU_H).right).toBe(0);
  });

  it("given a button overhanging the right edge > clamps rather than going negative", () => {
    const over: Rect = { top: 300, bottom: 332, left: 980, right: 1120 };
    expect(menuPosition(over, VIEWPORT, MENU_H).right).toBe(0);
  });
});
