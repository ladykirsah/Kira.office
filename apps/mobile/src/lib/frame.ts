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

export function bottomBar(chrome: { back: unknown; search: unknown; bare?: boolean }): BottomBar {
  if (chrome.bare) return "none";
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

/** The pinned band stays solid this far above the pinned stack, then fades out over BAND_FADE. */
export const BAND_SOLID_ABOVE = 20;
export const BAND_FADE = 28;

/**
 * How far the pinned band reaches above the pinned stack. A page whose last line must stay readable
 * at the end of the scroll (หน้าหลัก's ทำแล้ว · ล้างที่ทำแล้ว, owner 4 Nov 2026) leaves this much more room.
 */
export function bandOverhang(hasPinned: boolean): number {
  return hasPinned ? BAND_SOLID_ABOVE + BAND_FADE : 0;
}

/**
 * The colour stops of the pinned band, top to bottom. `edgeFade` > 0 melts its bottom away, for the
 * website, where the page shows on under Safari's bar.
 */
export function bandStops(band: number, edgeFade: number): { offset: number; opacity: number }[] {
  const top = [
    { offset: 0, opacity: 0 },
    { offset: BAND_FADE / band, opacity: 1 },
  ];
  if (edgeFade <= 0) return [...top, { offset: 1, opacity: 1 }];
  return [...top, { offset: (band - edgeFade) / band, opacity: 1 }, { offset: 1, opacity: 0 }];
}

/** How far the band melts away at the bottom on the website: the gap under the tab bar. */
export const WEB_EDGE_FADE = 22;

/** A phone sheet on a computer: a panel this wide on the right, the page still in sight. */
export const SIDE_PANEL_WIDTH = 440;

export function sheetPlacement(windowWidth: number, phoneMax: number): "bottom" | "side" {
  return windowWidth > phoneMax ? "side" : "bottom";
}

/**
 * How wide a computer page is (guide C · Mercury, 4 Nov 2026): settings and forms read as one
 * column, 880 wide and centred; a list page with a table takes the full width, up to 1280.
 */
export type PageLayout = "column" | "full";

const COLUMN_WIDTH = 880;
const FULL_WIDTH = 1280;

export function pageWidth(layout: PageLayout): number {
  return layout === "full" ? FULL_WIDTH : COLUMN_WIDTH;
}
