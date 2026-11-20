import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

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

// Reads the pixels of an 8-bit, non-interlaced PNG (grey, grey+alpha, RGB or RGBA), enough to look at an icon.
const decodePng = (b: Buffer) => {
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20), type = b[25];
  if (b[24] !== 8 || b[28] !== 0) throw new Error("expects an 8-bit, non-interlaced PNG");
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[type];
  const data: Buffer[] = [];
  for (let p = 8; p < b.length; p += 12 + b.readUInt32BE(p))
    if (b.toString("latin1", p + 4, p + 8) === "IDAT") data.push(b.subarray(p + 8, p + 8 + b.readUInt32BE(p)));
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0, up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? px[(y - 1) * stride + x - channels] : 0, v = raw[y * (stride + 1) + 1 + x];
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      const pred = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][filter];
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  const rgb = (x: number, y: number) => {
    const i = y * stride + x * channels;
    return channels < 3 ? [px[i], px[i], px[i]] : [px[i], px[i + 1], px[i + 2]];
  };
  return { width, height, rgb };
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

  // The owner asked for her exact logo file (20 Nov 2026), not a cleaned-up version: the grey wave lines stay.
  it("apple-icon.png > is the owner's AirPlus logo as is, grey wave lines in the corner included", () => {
    const { rgb } = decodePng(readFileSync(here("apple-icon.png")));
    let grey = 0;
    for (let y = 0; y < 45; y++)
      for (let x = 0; x < 45; x++) {
        const [r, g, b] = rgb(x, y);
        if (Math.abs(r - g) < 16 && Math.abs(g - b) < 20 && r > 140 && r < 204) grey++;
      }
    expect(grey / (45 * 45)).toBeGreaterThan(0.05);
  });
});
