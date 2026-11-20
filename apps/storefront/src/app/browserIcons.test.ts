import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The tab and phone icons of airplusauto.com. Next.js serves these files by name and writes the <link> tags itself.
const here = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const pngSize = (name: string) => {
  const b = readFileSync(here(name));
  return {
    png: b.subarray(1, 4).toString("latin1"),
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
  };
};

describe("storefront browser icons", () => {
  it("favicon.ico > holds the 16, 32 and 48 pixel tab icons", () => {
    const b = readFileSync(here("favicon.ico"));
    expect(b.readUInt16LE(2)).toBe(1); // 1 = icon file
    const sizes = Array.from({ length: b.readUInt16LE(4) }, (_, i) => b[6 + i * 16] || 256).sort(
      (x, y) => x - y,
    );
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("icon.png > is a square 512 pixel picture", () => {
    expect(pngSize("icon.png")).toEqual({ png: "PNG", width: 512, height: 512 });
  });

  it("apple-icon.png > is the 180 pixel phone home-screen icon", () => {
    expect(pngSize("apple-icon.png")).toEqual({ png: "PNG", width: 180, height: 180 });
  });
});
