// AirPlus thin-line icon set — the 17 interface icons the owner hand-picked from the icon picker
// (one metaphor per icon, "เส้นบาง" / thin-line theme). This is the single source of truth: every
// component renders these via <Icon> instead of hand-inlining SVG, so the store shows ONE
// consistent family. See Icon.tsx for rendering and globals.css `.ap-icon` for the constant line.
//
// Balance model (owner asked for "perfect and balanced" size + line weight):
//  - line weight: ONE value (ICON_STROKE), rendered as a flat, size-independent px via
//    `vector-effect: non-scaling-stroke` — a 1.5px line looks identical whether the icon is 13px
//    (product ribbon) or 32px (order-confirmation badge).
//  - optical size: each raw glyph fills the 24×24 box differently, so `scale`/`cx`/`cy` contain-fit
//    each one into the same optical box (a wide truck shrinks, a short coupon grows). Scales are
//    kept in a tight range so the constant line still reads evenly.

export type IconName =
  | "back"
  | "search"
  | "cart"
  | "profile"
  | "share"
  | "truck"
  | "check"
  | "coupon"
  | "wrench"
  | "chat"
  | "orders"
  | "address"
  | "filter"
  | "close"
  | "trash"
  | "logout"
  | "chevron";

export interface Glyph {
  /** inner SVG markup (stroke-only) drawn in a 0 0 24 24 viewBox */
  inner: string;
  /** optical-size multiplier about the box centre (default 1) */
  scale?: number;
  /** glyph centre X to re-centre on after scaling (default 12) */
  cx?: number;
  /** glyph centre Y to re-centre on after scaling (default 12) */
  cy?: number;
}

/** The one line weight for the whole set; rendered flat via non-scaling-stroke. */
export const ICON_STROKE = 1.5;

export const ICONS: Record<IconName, Glyph> = {
  back: {
    inner: '<path d="M15 18l-6-6 6-6"/>',
  },
  search: {
    inner: '<circle cx="11" cy="11" r="7.5"/><path d="M16.8 16.8 21 21"/>',
    scale: 1.05,
  },
  cart: {
    inner:
      '<path d="M2 3h2.3a1 1 0 0 1 .98.8L5.7 6H21a.8.8 0 0 1 .78 1l-1.5 6.6a2 2 0 0 1-1.95 1.5H9.1a2 2 0 0 1-1.96-1.6L5.7 6"/><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/>',
    scale: 0.96,
    cy: 12.5,
  },
  profile: {
    inner: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    scale: 1.08,
    cy: 12.5,
  },
  share: {
    inner:
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/>',
    scale: 0.95,
  },
  truck: {
    inner:
      '<rect x="1" y="5" width="14" height="11" rx="1.5"/><path d="M15 8h4l4 4v4h-8"/><circle cx="6" cy="18.5" r="1.9"/><circle cx="18" cy="18.5" r="1.9"/>',
    scale: 0.9,
    cy: 12.65,
  },
  check: {
    inner: '<path d="M5 13l4 4L19 7"/>',
    scale: 1.16,
    cy: 12.5,
  },
  coupon: {
    inner:
      '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.6a1.9 1.9 0 0 0 0 3.8v1.6A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-1.6a1.9 1.9 0 0 0 0-3.8Z"/><path d="M9.6 10.4l4.8 3.2"/>',
    scale: 1.22,
  },
  wrench: {
    inner:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    scale: 1.05,
    cx: 12.5,
    cy: 11.5,
  },
  chat: {
    inner:
      '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/><path d="M8 8h8M8 11h5"/>',
    scale: 1.02,
    cy: 11.5,
  },
  orders: {
    inner:
      '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/><path d="M8 5l8 4"/>',
    scale: 1.0,
  },
  address: {
    inner:
      '<path d="M3.2 11 12 3.5 20.8 11"/><path d="M5.5 9.2v9.3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.2"/><path d="M9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20"/>',
    scale: 1.05,
    cy: 11.75,
  },
  filter: {
    inner:
      '<path d="M4 7h16M4 12h16M4 17h16"/><rect x="7.5" y="5" width="3" height="4" rx=".8"/><rect x="13.5" y="10" width="3" height="4" rx=".8"/><rect x="6" y="15" width="3" height="4" rx=".8"/>',
    scale: 1.0,
  },
  close: {
    inner: '<path d="M18 6 6 18M6 6l12 12"/>',
    scale: 1.1,
  },
  trash: {
    inner:
      '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 1.9h8a2 2 0 0 0 2-1.9L19 7M9 7V4h6v3"/>',
    scale: 1.0,
    cy: 12.5,
  },
  logout: {
    inner:
      '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M17 16l4-4-4-4"/><path d="M21 12H10"/>',
    scale: 1.0,
  },
  chevron: {
    inner: '<path d="M9 6l6 6-6 6"/>',
  },
};

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/**
 * Build the optical-normalisation transform for a glyph: scale about the box centre (12,12), then
 * re-centre on the glyph's own middle (cx,cy). Returns "" for a centred, unscaled glyph so no
 * <g transform> node is emitted. Pairs with non-scaling-stroke, so scaling never changes the line.
 */
export function glyphTransform(scale = 1, cx = 12, cy = 12): string {
  if (scale === 1 && cx === 12 && cy === 12) return "";
  return `translate(12 12) scale(${scale}) translate(${-cx} ${-cy})`;
}
