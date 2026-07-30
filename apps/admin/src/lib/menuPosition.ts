/** The gap between an "Action" button and its menu, in px — matches `top: calc(100% + 4px)`. */
const GAP = 4;

/** The part of a DOMRect this needs; keeps the maths testable without a DOM. */
export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where to pin a row-action menu, in viewport (`position: fixed`) coordinates.
 *
 * The menu is portalled to <body> because its row lives inside the table's `overflow-x: auto`
 * scroller, which also clips vertically — an absolutely-positioned menu on the last row would be
 * cut off by the frame. Prefers opening downward, flips above when the menu would overrun the
 * viewport floor, and clamps so it can never be positioned off-screen.
 */
export function menuPosition(
  button: Rect,
  viewport: { width: number; height: number },
  menuHeight: number,
): { top: number; right: number } {
  const below = button.bottom + GAP;
  const above = button.top - GAP - menuHeight;

  // Flip above only when there genuinely is not room below, and only if above is actually on
  // screen — for a menu taller than the viewport both are bad, so keep the top edge visible.
  const fitsBelow = below + menuHeight <= viewport.height;
  let top = fitsBelow || above < 0 ? below : above;
  top = Math.max(0, Math.min(top, Math.max(0, viewport.height - GAP)));

  // Right-aligned to the button, mirroring the menu's CSS `right: 0`, clamped to the viewport.
  const right = Math.max(0, viewport.width - button.right);

  return { top, right };
}
