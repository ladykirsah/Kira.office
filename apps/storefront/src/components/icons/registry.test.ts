import { describe, it, expect } from "vitest";
import { ICON_NAMES, ICONS, ICON_STROKE, glyphTransform, type IconName } from "./registry";

const EXPECTED: IconName[] = [
  "back",
  "search",
  "cart",
  "profile",
  "share",
  "truck",
  "check",
  "coupon",
  "wrench",
  "chat",
  "orders",
  "address",
  "filter",
  "close",
  "trash",
  "logout",
  "chevron",
];

describe("icon registry", () => {
  it("exposes exactly the 17 chosen interface icons", () => {
    expect([...ICON_NAMES].sort()).toEqual([...EXPECTED].sort());
  });

  it("every icon has non-empty, currentColor-friendly (stroke-only) markup", () => {
    for (const name of ICON_NAMES) {
      const glyph = ICONS[name];
      expect(glyph, name).toBeTruthy();
      expect(glyph.inner.length, name).toBeGreaterThan(0);
      // Hardcoded stroke/fill colors would defeat currentColor theming (white on the
      // coral header, coral on white surfaces). Chosen glyphs must be pure stroke.
      expect(glyph.inner, name).not.toMatch(/fill="#/);
      expect(glyph.inner, name).not.toMatch(/stroke="#/);
    }
  });

  it("keeps every optical scale in a tight, balance-safe range", () => {
    for (const name of ICON_NAMES) {
      const s = ICONS[name].scale;
      if (s !== undefined) {
        expect(s, name).toBeGreaterThanOrEqual(0.8);
        expect(s, name).toBeLessThanOrEqual(1.3);
      }
    }
  });

  it("uses one constant line weight (rendered flat via non-scaling-stroke)", () => {
    expect(ICON_STROKE).toBeGreaterThan(0);
    expect(ICON_STROKE).toBeLessThan(3);
  });
});

describe("glyphTransform", () => {
  it("emits no transform for a centred, unscaled glyph", () => {
    expect(glyphTransform()).toBe("");
    expect(glyphTransform(1)).toBe("");
    expect(glyphTransform(1, 12, 12)).toBe("");
  });

  it("scales about the 12,12 centre and re-centres on the glyph's own middle", () => {
    const t = glyphTransform(0.909, 12, 12.65);
    expect(t).toContain("translate(12 12)");
    expect(t).toContain("scale(0.909)");
    expect(t).toContain("translate(-12 -12.65)");
  });

  it("supports a pure upscale for optically small glyphs", () => {
    expect(glyphTransform(1.25)).toContain("scale(1.25)");
  });
});
