import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

// TeamPit's tab and phone icons: files in public/ are served from the site root, and index.html links them.
const pub = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

// Reads the pixels of an 8-bit, non-interlaced PNG (grey, grey+alpha, RGB or RGBA), enough to look at an icon.
const decodePng = (b: Buffer) => {
  const width = b.readUInt32BE(16),
    height = b.readUInt32BE(20),
    channels = [1, 0, 3, 0, 2, 0, 4][b.readUInt8(25)] ?? 0;
  if (b.readUInt8(24) !== 8 || b.readUInt8(28) !== 0 || !channels)
    throw new Error("expects an 8-bit, non-interlaced PNG");
  const data: Buffer[] = [];
  for (let p = 8; p < b.length; p += 12 + b.readUInt32BE(p))
    if (b.toString("latin1", p + 4, p + 8) === "IDAT")
      data.push(b.subarray(p + 8, p + 8 + b.readUInt32BE(p)));
  const raw = inflateSync(Buffer.concat(data)),
    stride = width * channels,
    px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw.readUInt8(y * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px.readUInt8(y * stride + x - channels) : 0,
        up = y ? px.readUInt8((y - 1) * stride + x) : 0,
        c = x >= channels && y ? px.readUInt8((y - 1) * stride + x - channels) : 0;
      const pa = Math.abs(up - c),
        pb = Math.abs(a - c),
        pc = Math.abs(a + up - 2 * c);
      const pred =
        [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][filter] ?? 0;
      px.writeUInt8((raw.readUInt8(y * (stride + 1) + 1 + x) + pred) & 255, y * stride + x);
    }
  }
  const rgb = (x: number, y: number): [number, number, number] => {
    const at = (k: number) => px.readUInt8(y * stride + x * channels + k);
    return channels < 3 ? [at(0), at(0), at(0)] : [at(0), at(1), at(2)];
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
