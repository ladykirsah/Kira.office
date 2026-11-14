/**
 * Apple's own text styles for the AirPlus phone pages (owner, 14 Nov 2026: "i want THE SAME as real Apple
 * system"). Sizes are a normal iPhone's ("Large" text size). In iPhone Safari each page's follow block swaps
 * them for `font: -apple-system-<style>`, which grows or shrinks with the phone's text size setting just like
 * Apple's apps. Style names and sizes were read in simulator Safari, 14 Nov 2026.
 */
export const APPLE_STYLES: Record<string, { size: number }> = {
  title0: { size: 34 },
  title1: { size: 28 },
  title2: { size: 22 },
  title3: { size: 20 },
  headline: { size: 17 },
  body: { size: 17 },
  subheadline: { size: 15 },
  footnote: { size: 13 },
  caption1: { size: 12 },
  caption2: { size: 11 },
};

/**
 * Bars, badges and marks keep one size, as in Apple's apps (tab bar labels, the title bar, count badges and the
 * countdown boxes don't grow with the text size setting).
 */
export const FIXED_TEXT: string[] = [
  // home · title bars, tab bar, badges, the FLASH SALE mark and its countdown boxes, ribbons
  ".hm-head-badge",
  ".sub-head-t",
  ".sub-head-badge",
  ".hm-sheet-title b",
  ".hm-sheet-title span",
  ".tb-tab--on",
  ".tb-badge",
  ".hm-flash-t",
  ".hm-flash-head .cd-box",
  ".hm-flash-head .cd-sep",
  ".hm-ribbon-top",
  ".hm-ribbon-n",
  ".hm-rank",
  ".hm-pct",
  ".hm-partner",
  ".sz-stepper button",
  // search
  ".b2-badge",
  // product · photo buttons and count, sale badge, bottom bar, toast
  "body:has(.pp) .ap-toast",
  ".pp-gal-none",
  ".pp-ov-badge",
  ".pp-gal-count",
  ".pp-flash-pct",
  ".pp-bar-btn",
  ".pp-bar-buy",
];

const FOLLOW_HEAD = /@supports\s*\(font:\s*-apple-system-body\)\s*\{\s*@media\s*([^{]+)\{/;
/** Computers keep today's look; a block for them only is not part of the phone pages. */
const COMPUTER_HEAD = /@media\s*\(min-width:\s*720px\)\s*\{/g;

/** The braced block that starts at `from` (the at-rule through its closing brace). */
function blockFrom(css: string, from: number): string {
  let depth = 0;
  for (let i = from; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(from, i + 1);
  }
  return css.slice(from);
}

/** The page's follow block (everything inside `@supports (font: -apple-system-body)`), or "". */
function followBlockText(css: string): string {
  const m = FOLLOW_HEAD.exec(css);
  return m ? blockFrom(css, m.index) : "";
}

function withoutComputerBlocks(css: string): string {
  const blocks = [...css.matchAll(COMPUTER_HEAD)].map((m) => blockFrom(css, m.index));
  return blocks.reduce((rest, b) => rest.replace(b, ""), css);
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitSelectors(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Every rule that sets a px text size, outside the follow block: selector, size and weight. */
export function textRules(css: string): { selector: string; size: number; weight: number }[] {
  const clean = withoutComputerBlocks(stripComments(css));
  const block = followBlockText(clean);
  const rest = block ? clean.replace(block, "") : clean;
  const out: { selector: string; size: number; weight: number }[] = [];
  for (const m of rest.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const size = /font-size:\s*([\d.]+)px/.exec(m[2]!);
    if (!size) continue;
    const weight = /font-weight:\s*(\d+)/.exec(m[2]!);
    for (const selector of splitSelectors(m[1]!)) {
      out.push({ selector, size: Number(size[1]), weight: weight ? Number(weight[1]) : 400 });
    }
  }
  return out;
}

/** Selector → Apple style name, from the follow block. */
export function followBlock(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const block = followBlockText(stripComments(css));
  const inner = block.replace(FOLLOW_HEAD, "");
  for (const m of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const style = /font:\s*-apple-system-([a-z0-9]+)/.exec(m[2]!);
    if (!style) continue;
    for (const selector of splitSelectors(m[1]!)) map.set(selector, style[1]!);
  }
  return map;
}

/** The follow block's two conditions, written back in one line (for the test that guards them). */
export function followBlockGuard(css: string): string {
  const m = FOLLOW_HEAD.exec(stripComments(css));
  return m ? `@supports (font: -apple-system-body) { @media ${m[1]!.trim()}` : "";
}
