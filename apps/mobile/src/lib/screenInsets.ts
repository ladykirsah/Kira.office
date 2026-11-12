/**
 * How far the screen's clock, notch and home bar reach into the page, read from the screen itself.
 * On the website the whole phone page scrolls (lib/pageScroll), so the edges cannot be read from
 * the page's own box: it is taller than the screen and moves. No screen code here.
 */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const px = (value: string): number => (value ? parseInt(value, 10) || 0 : 0);

/** A probe padded by env(safe-area-inset-*) reports the four edges as its computed padding. */
export const insetsFromPadding = (p: {
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
}): Insets => ({
  top: px(p.paddingTop),
  right: px(p.paddingRight),
  bottom: px(p.paddingBottom),
  left: px(p.paddingLeft),
});

export const sameInsets = (a: Insets, b: Insets): boolean =>
  a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
