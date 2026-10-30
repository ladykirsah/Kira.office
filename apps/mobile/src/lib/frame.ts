/**
 * Where the phone frame puts its bottom bar and the pinned buttons (owner, 29 Oct 2026, from Apple
 * and Shopee): the tab bar belongs to the main pages only. A page with a back link sits under
 * another one, so it has no bar and its main action drops to just above the home bar.
 * No screen code here.
 */

export type BottomBar = "tabs" | "search" | "none";

/** The bar floats 22 above the bottom edge (guide), 62 tall; the page keeps 110 clear of it. */
const BAR_GAP = 22;
const BAR_HEIGHT = 62;
const BAR_CLEARANCE = 110;
/** Pinned buttons above the bar sit 16 over it. */
const OVER_BAR = 16;
/** With no bar, the drawing puts the pinned buttons 34 from the bottom edge (the home bar). */
const HOME = 34;
/** The last card stops this far above the pinned buttons. */
const ABOVE_PINNED = 16;

export function bottomBar(chrome: { back: unknown; search: unknown }): BottomBar {
  if (chrome.search) return "search";
  if (chrome.back) return "none";
  return "tabs";
}

/** The bar's own distance from the bottom edge: 22, or just above a phone's home indicator. */
export function barBottom(insetBottom: number): number {
  return Math.max(BAR_GAP, insetBottom - 12);
}

/**
 * `footer`: from the bottom edge to the pinned buttons. `content`: the room the page leaves under
 * its last card. `pinned` is how much the pinned stack covers (PinnedFooter's pinnedHeight).
 */
export function phoneBottoms(input: { bar: BottomBar; insetBottom: number; pinned: number }): {
  footer: number;
  content: number;
} {
  if (input.bar === "none") {
    const footer = Math.max(HOME, input.insetBottom);
    return { footer, content: footer + input.pinned + ABOVE_PINNED };
  }
  return {
    footer: barBottom(input.insetBottom) + BAR_HEIGHT + OVER_BAR,
    content: BAR_CLEARANCE + input.pinned + input.insetBottom,
  };
}
