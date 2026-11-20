import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// TeamPit's tab and phone icons: files in public/ are served from the site root, and index.html links them.
const pub = (name: string) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

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
});
