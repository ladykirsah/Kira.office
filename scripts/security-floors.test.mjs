import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// GitHub's security warnings for this project's add-ons (owner, 18 Nov 2026: "Go" on the clean-up
// plan). Each range below is a vulnerable range GitHub lists, ending at the first fixed version, so
// an `npm install` that slides a copy back into one fails here instead of reopening the warning.
// Not listed: glob, minimatch and picomatch — no fixed version is released inside the ranges Expo's
// and the storefront's build tools accept (18 Nov 2026); add them once one is.
const VULNERABLE = {
  "brace-expansion": [
    ["0.0.0", "1.1.21"],
    ["2.0.0", "2.1.7"],
    ["4.0.0", "5.0.12"],
  ],
  dompurify: [["0.0.0", "3.4.17"]],
  "js-yaml": [["4.0.0", "4.3.2"]],
  "node-forge": [["0.0.0", "1.4.3"]],
  "proxy-addr": [["1.1.0", "2.0.8"]],
  qs: [["6.7.0", "6.16.1"]],
  sharp: [["0.0.0", "0.35.5"]],
  "source-map-js": [["1.0.0", "1.2.2"]],
  vite: [["7.0.0", "7.3.7"]],
  vitest: [["2.1.0", "4.1.11"]],
  "@vitest/mocker": [["2.1.0", "4.1.12"]],
  tinypool: [["0.0.0", "2.1.2"]],
  undici: [["7.0.0", "7.30.1"]],
  zod: [["0.0.0", "4.6.6"]],
};

/** "1.4.0-beta.2" → [1, 4, 0]; pre-release tags are ignored (none of the fixes are pre-releases). */
const parts = (version) => version.split("-")[0].split(".").map(Number);

function compare(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

/** Every installed copy in the lock file: "node_modules/a/node_modules/b" → { name: "b", version }. */
function installedCopies() {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  return Object.entries(lock.packages)
    .filter(([where, entry]) => where.includes("node_modules/") && entry.version && !entry.link)
    .map(([where, entry]) => ({
      where,
      name: where.slice(where.lastIndexOf("node_modules/") + "node_modules/".length),
      version: entry.version,
    }));
}

describe("security floors > the lock file", () => {
  it("given GitHub's vulnerable ranges > then no installed add-on sits inside one", () => {
    const flagged = installedCopies()
      .filter(({ name, version }) =>
        (VULNERABLE[name] ?? []).some(
          ([from, to]) => compare(version, from) >= 0 && compare(version, to) < 0,
        ),
      )
      .map(({ where, version }) => `${where}@${version}`);
    expect(flagged).toEqual([]);
  });

  it("given the comparison > then it orders versions by number, not by text", () => {
    expect(compare("1.4.10", "1.4.3")).toBeGreaterThan(0);
    expect(compare("7.28.0", "7.30.1")).toBeLessThan(0);
    expect(compare("4.1.12", "4.1.12")).toBe(0);
  });
});
