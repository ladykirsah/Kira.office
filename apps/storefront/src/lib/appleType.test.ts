import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APPLE_STYLES, FIXED_TEXT, followBlock, followBlockGuard, textRules } from "./appleType";

/**
 * AirPlus looks THE SAME as Apple's own apps (owner, 14 Nov 2026: "i want THE SAME as real Apple system" ·
 * "All AirPlus pages" · "no dark mode for AirPlus"). Their iPhone's text size is Small, so Settings shows
 * rows at 15 and grey lines at 12, where a normal iPhone shows 17 and 13. Apple's apps follow that setting;
 * these tests make every phone page do the same, with only Apple's own sizes and colours.
 */
const PHONE_CSS = [
  "../components/home/home-phone.css",
  "../components/browse/browse-phone.css",
  "../components/product/product-phone.css",
  "../components/cart/cart-phone.css",
].map((p) => [p, readFileSync(join(__dirname, p), "utf8")] as const);

const APPLE_SIZES = new Set(Object.values(APPLE_STYLES).map((s) => s.size));

describe("AirPlus phone pages · Apple text", () => {
  it.each(PHONE_CSS)("%s > uses only Apple's text sizes", (_file, css) => {
    const off = textRules(css).filter(
      (r) => !APPLE_SIZES.has(r.size) && !FIXED_TEXT.includes(r.selector),
    );
    expect(off).toEqual([]);
  });

  it.each(PHONE_CSS)(
    "%s > every text follows the phone's text size with the matching Apple style, except bars and badges",
    (_file, css) => {
      const follow = followBlock(css);
      const missing = textRules(css)
        .filter((r) => !FIXED_TEXT.includes(r.selector))
        .filter((r) => {
          const style = follow.get(r.selector);
          return !style || APPLE_STYLES[style]?.size !== r.size;
        })
        .map((r) => `${r.selector} ${r.size}`);
      expect(missing).toEqual([]);
    },
  );

  it.each(PHONE_CSS)(
    "%s > follows the phone only in iPhone Safari (a Mac would turn body text into 13)",
    (_file, css) => {
      expect(followBlockGuard(css)).toBe(
        "@supports (font: -apple-system-body) { @media (max-width: 719px) and (pointer: coarse)",
      );
    },
  );

  it("text colours are Apple's: black, and grey #8A8A8E for second lines", () => {
    const [, home] = PHONE_CSS[0];
    expect(home).toMatch(/--hm-ink:\s*#000000;/);
    expect(home).toMatch(/--hm-grey:\s*#8a8a8e;/);
  });
});

describe("textRules", () => {
  it("textRules > given rules with px sizes > selector, size and weight of each", () => {
    expect(
      textRules(".a { font-size: 17px; font-weight: 600; }\n.b, .c { font-size: 13px; }"),
    ).toEqual([
      { selector: ".a", size: 17, weight: 600 },
      { selector: ".b", size: 13, weight: 400 },
      { selector: ".c", size: 13, weight: 400 },
    ]);
  });
  it("textRules > given a rule inside a phone media query > still read", () => {
    expect(textRules("@media (max-width: 719px) { .a { font-size: 15px; } }")).toEqual([
      { selector: ".a", size: 15, weight: 400 },
    ]);
  });
  it("textRules > given a computer-only block > skipped (computers keep today's page)", () => {
    expect(
      textRules(
        ".a { font-size: 17px; }\n@media (min-width: 720px) {\n  .a { font-size: 24px; }\n}",
      ),
    ).toEqual([{ selector: ".a", size: 17, weight: 400 }]);
  });
  it("textRules > given the follow block > not counted as a fixed size", () => {
    const css =
      ".a { font-size: 17px; }\n@supports (font: -apple-system-body) { @media (max-width: 719px) and (pointer: coarse) { .a { font: -apple-system-body; } } }";
    expect(textRules(css)).toEqual([{ selector: ".a", size: 17, weight: 400 }]);
  });
});

describe("followBlock", () => {
  const css =
    ".a { font-size: 17px; }\n@supports (font: -apple-system-body) {\n  @media (max-width: 719px) and (pointer: coarse) {\n    .a,\n    .b { font: -apple-system-body; line-height: 1.29; }\n    .c { font: -apple-system-title2; font-weight: 700; }\n  }\n}";
  it("followBlock > given the block > each selector with its Apple style", () => {
    expect([...followBlock(css)]).toEqual([
      [".a", "body"],
      [".b", "body"],
      [".c", "title2"],
    ]);
  });
  it("followBlock > given no block > empty", () => {
    expect(followBlock(".a { font-size: 17px; }").size).toBe(0);
  });
  it("followBlockGuard > given the block > its two conditions", () => {
    expect(followBlockGuard(css)).toBe(
      "@supports (font: -apple-system-body) { @media (max-width: 719px) and (pointer: coarse)",
    );
  });
});
