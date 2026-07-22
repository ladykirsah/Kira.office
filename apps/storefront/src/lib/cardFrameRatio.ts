/**
 * The house rule for card image frames: every one is square.
 *
 * Mixed ratios inside a single scrolling row read as misalignment even when the grid itself is
 * perfect — the eye tracks the image edges, not the card edges. `.rec-frame` (the mechanic-picks
 * affiliate card) had drifted to 4/3 and was the lone outlier; the owner spotted it on the live
 * homepage sitting beside the square product and category tiles.
 *
 * This module exists so the rule is enforced by a test rather than by remembering it.
 */

/** Card image frames that must be 1 / 1. Add new card frames here when you add them to the CSS. */
export const SQUARE_CARD_FRAMES = [
  ".compact-card .ci-frame", // product cards
  ".cat-thumb", // category tiles
  ".car-thumb", // car-brand tiles
  ".rec-frame", // mechanic-picks affiliate cards
] as const;

/**
 * The `aspect-ratio` declared for `selector` in `css`, normalised to "a / b", or null if the
 * selector has no such declaration.
 *
 * A deliberately small reader rather than a CSS parser dependency: it only has to answer one
 * question about one stylesheet we control. It matches the selector at the start of a rule and
 * requires the block to open, so `.cat-thumb` cannot pick up `.cat-thumb-large`'s value.
 */
export function aspectRatioOf(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Selector, optional whitespace, then `{`, then everything up to the closing `}`.
  const block = new RegExp(`(?:^|[\\n},])\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!block) return null;

  const ratio = /aspect-ratio\s*:\s*([^;]+)/.exec(block[1]!);
  if (!ratio) return null;

  return ratio[1]!.trim().replace(/\s*\/\s*/, " / ");
}
