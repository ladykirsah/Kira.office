import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appFontLoaded } from "./appFont";

// Owner, 20 Nov 2026 (plan 11.1): "B + IBM Plex" — every word in TeamPit is in IBM Plex Sans Thai,
// the same on every phone and computer; the TeamPit name stays in Space Grotesk. Plan 11.6 (owner,
// 20 Nov, "papers A"): the printed papers (bill and quote, barcode labels, parcel label) too.

const SRC = join(__dirname, "..");

/** Where a paper becomes a picture (html2canvas): the bill and quote, the label sheet, the parcel label. */
const PICTURE_TAKERS = [
  "ui/pos/saveDoc.web.ts",
  "ui/barcodes/saveSheet.web.ts",
  "ui/orders/saveLabel.web.ts",
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

/** The `{ … }` that holds position `at`: walk back to its unmatched `{`, then on to its `}`. */
function enclosingObject(code: string, at: number): string {
  let depth = 0;
  let start = at;
  for (; start >= 0; start--) {
    const c = code[start];
    if (c === "}") depth++;
    if (c === "{") {
      if (depth === 0) break;
      depth--;
    }
  }
  depth = 0;
  for (let end = start; end < code.length; end++) {
    const c = code[end];
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return code.slice(start, end + 1);
  }
  return code.slice(start);
}

/** Each text style (an object with a fontSize) that names no font: not the app's, not its own. */
function stylesWithoutFont(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/\bfontSize\s*:/g)) {
    const style = enclosingObject(code, m.index);
    if (/\bfontFamily\s*:|\.\.\.\s*(?:TYPE\.|APP_FONT_STYLE\b)/.test(style)) continue;
    out.push(style.replace(/\s+/g, " ").slice(0, 80));
  }
  return out;
}

describe("app font", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("every text style in the app > given any screen > then it is in the app font", () => {
    const offenders = sources(SRC).flatMap((file) =>
      stylesWithoutFont(readFileSync(file, "utf8")).map((s) => `${relative(SRC, file)}: ${s}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the check > given a style with a size and no font > then it catches it", () => {
    expect(stylesWithoutFont("const s = { badge: { fontSize: 13, color: x } };")).toEqual([
      "{ fontSize: 13, color: x }",
    ]);
  });

  it("the check > given a style that spreads a guide size or names a font > then it passes", () => {
    const code =
      "a: { ...TYPE.body, fontSize: 20 }, b: { fontSize: 13, fontFamily: APP_FONT }, " +
      "c: { ...APP_FONT_STYLE, fontSize: 11 }";
    expect(stylesWithoutFont(code)).toEqual([]);
  });

  it("the web page > given the three weights the guide uses > then it loads each from a shipped file", () => {
    const html = readFileSync(join(SRC, "../public/index.html"), "utf8");
    for (const weight of [400, 600, 700]) {
      const face = [...html.matchAll(/@font-face\s*{[^}]*}/g)]
        .map((m) => m[0])
        .find(
          (f) =>
            /font-family:\s*"IBM Plex Sans Thai"/.test(f) && f.includes(`font-weight: ${weight}`),
        );
      expect(face, `@font-face for ${weight}`).toBeDefined();
      const file = /url\("\/(fonts\/[^"]+\.ttf)"\)/.exec(face!)?.[1];
      expect(file, `file for ${weight}`).toBeDefined();
      expect(readFileSync(join(SRC, "../public", file!)).length).toBeGreaterThan(50_000);
      expect(face).toMatch(/font-display:\s*swap/);
    }
  });

  it("the TeamPit name > given its own font > then no style after it in its list puts another back", () => {
    // Found on the practice copy (20 Nov): the computer sign-in sized the name after its font, so
    // the app font replaced Space Grotesk there.
    const late = sources(SRC).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/style=\{\[([^\]]*\bbrandFont\b[^\]]*)\]\}/g)]
        .map((m) =>
          m[1]!
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
        .filter((entries) => entries.at(-1) !== "brandFont")
        .map((entries) => `${relative(SRC, file)}: ${entries.join(", ")}`),
    );
    expect(late).toEqual([]);
  });

  it("a paper's picture > given the font may not be in yet > then it waits for it first", () => {
    for (const file of PICTURE_TAKERS) {
      const code = readFileSync(join(SRC, file), "utf8");
      const wait = code.indexOf("await appFontLoaded()");
      expect(wait, `${file} waits for the font`).toBeGreaterThan(-1);
      expect(wait, `${file} waits before the picture`).toBeLessThan(code.indexOf("html2canvas("));
    }
  });

  it("appFontLoaded > given the page's fonts > then it asks for all three weights", async () => {
    const load = vi.fn<(font: string) => Promise<unknown[]>>(async () => []);
    vi.stubGlobal("document", { fonts: { load } });
    await appFontLoaded();
    expect(load.mock.calls.map((c) => c[0])).toEqual([
      '400 16px "IBM Plex Sans Thai"',
      '600 16px "IBM Plex Sans Thai"',
      '700 16px "IBM Plex Sans Thai"',
    ]);
  });
});
