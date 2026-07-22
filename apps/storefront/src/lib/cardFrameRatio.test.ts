import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aspectRatioOf, SQUARE_CARD_FRAMES } from "./cardFrameRatio";

/**
 * The storefront's card image frames are all square. That is a house rule, not an accident: mixed
 * ratios in one scrolling row make the cards look misaligned even when the grid is perfect.
 *
 * `.rec-frame` (the mechanic-picks affiliate card) had drifted to 4/3 and was the only outlier —
 * the owner spotted it on the live homepage. This test pins the rule so the next new card cannot
 * quietly drift the same way.
 */
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

describe("card image frames", () => {
  it.each(SQUARE_CARD_FRAMES)("%s is 1 / 1", (selector) => {
    expect(aspectRatioOf(css, selector)).toBe("1 / 1");
  });

  it("covers every frame the affiliate row sits next to, so a row never mixes ratios", () => {
    // Guard on the LIST, not just the values: adding a card frame without listing it here would
    // otherwise leave it untested and free to drift.
    expect(SQUARE_CARD_FRAMES).toContain(".rec-frame");
    expect(SQUARE_CARD_FRAMES).toContain(".cat-thumb");
    expect(SQUARE_CARD_FRAMES).toContain(".car-thumb");
    expect(SQUARE_CARD_FRAMES).toContain(".compact-card .ci-frame");
  });
});

describe("aspectRatioOf", () => {
  it("given a selector with a ratio > returns it normalised", () => {
    expect(aspectRatioOf(".x {\n  aspect-ratio: 4/3;\n}", ".x")).toBe("4 / 3");
  });

  it("given a selector with no ratio > returns null rather than guessing", () => {
    expect(aspectRatioOf(".x {\n  color: red;\n}", ".x")).toBeNull();
  });

  it("given a missing selector > returns null", () => {
    expect(aspectRatioOf(".x { aspect-ratio: 1/1; }", ".nope")).toBeNull();
  });

  it("given a selector that is a prefix of another > does not match the wrong block", () => {
    // ".cat-thumb" must not accidentally read ".cat-thumb-large"'s ratio.
    const sheet =
      ".cat-thumb-large {\n aspect-ratio: 16/9;\n}\n.cat-thumb {\n aspect-ratio: 1/1;\n}";
    expect(aspectRatioOf(sheet, ".cat-thumb")).toBe("1 / 1");
  });
});
