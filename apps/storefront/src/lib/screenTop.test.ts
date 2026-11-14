import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The red fills the strip behind the iPhone clock on the phone home (owner, 14 Nov 2026: "make sure to
 * fill up the background", showing a grey strip above the red AirPlus top). iPhone Safari paints that strip
 * with the page colour (or with a bar pinned to the top, which the home's red top is not), so the home's page
 * colour is red, under a grey picture that keeps the page itself grey.
 */
const homeCss = readFileSync(join(__dirname, "../components/home/home-phone.css"), "utf8");

describe("phone home > the strip behind the clock", () => {
  it("phone home > given iPhone Safari paints the clock strip with the page colour > that colour is red", () => {
    expect(homeCss).toMatch(
      /body:has\(\.home-phone\)\s*\{[^}]*background:\s*linear-gradient\(var\(--hm-bg\),\s*var\(--hm-bg\)\)\s*var\(--hm-red\);/,
    );
  });
});
