import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

// TeamPit's tab and phone icons: files in public/ are served from the site root, and index.html links them.
const pub = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

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

describe("TeamPit browser icons", () => {
  it("index.html > links the tab icon and the phone home-screen icon", () => {
    const html = readFileSync(pub("index.html"), "utf8");
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico" sizes="48x48" \/>/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
  });

  it("icon files > are there to be served", () => {
    for (const name of ["favicon.ico", "apple-touch-icon.png", "icon-192.png"])
      expect(existsSync(pub(name)), name).toBe(true);
  });

  // The owner asked for her exact logo file (20 Nov 2026), not a crop: the full word mark with dark space above it.
  it("apple-touch-icon.png > is the owner's TeamPit logo as is, the top third plain dark grey", () => {
    const { width, rgb } = decodePng(readFileSync(pub("apple-touch-icon.png")));
    let dark = 0;
    for (let y = 0; y < 54; y++)
      for (let x = 0; x < width; x++) {
        const [r, g, b] = rgb(x, y);
        if (r < 64 && g < 64 && b < 64) dark++;
      }
    expect(dark / (54 * width)).toBeGreaterThan(0.99);
  });
});
