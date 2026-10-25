import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findHiddenCode } from "./check-hidden-code.mjs";

const SCRIPT = fileURLToPath(new URL("./check-hidden-code.mjs", import.meta.url));

function gitRepoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "hidden-code-repo-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["add", "."], { cwd: dir });
  return dir;
}

function runCheck(files) {
  const dir = mkdtempSync(join(tmpdir(), "hidden-code-"));
  const paths = Object.entries(files).map(([name, text]) => {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  });
  return spawnSync(process.execPath, [SCRIPT, ...paths], { encoding: "utf8" });
}

// The loader's fingerprints, assembled at run time: written out literally, this file would trip
// the very check it tests the moment CI scans it.
const LOADER = {
  globalO: ["global", "o"].join("."),
  hexVar: "_$" + "_6fe2",
  charCode127: ["String", "fromCharCode(127)"].join("."),
};

describe("findHiddenCode", () => {
  it("given code pushed off-screen behind a long run of spaces > flags that line", () => {
    const text = `const config = [];\n\nexport default config;${" ".repeat(709)}global.x = require;\n`;

    const findings = findHiddenCode(text, "apps/admin/eslint.config.mjs");

    expect(findings).toEqual([expect.objectContaining({ line: 3, rule: "hidden-after-spaces" })]);
  });

  it("given the loader's known fingerprints on an ordinary-looking line > flags each one", () => {
    const text = [
      `${LOADER.globalO}='8-hhn4257';`,
      `var ${LOADER.hexVar}=(function(c,l){return c})('',1);`,
      `var k=${LOADER.charCode127};`,
    ].join("\n");

    const findings = findHiddenCode(text, "apps/storefront/eslint.config.mjs");

    expect(findings.map((f) => [f.line, f.rule])).toEqual([
      [1, "loader-fingerprint"],
      [2, "loader-fingerprint"],
      [3, "loader-fingerprint"],
    ]);
  });

  it("given a code file with one extremely long line > flags that line", () => {
    const text = `const ok = 1;\nconst blob = "${"x".repeat(6000)}";\n`;

    const findings = findHiddenCode(text, "apps/admin/next.config.ts");

    expect(findings).toEqual([expect.objectContaining({ line: 2, rule: "very-long-line" })]);
  });

  it("given a data file with one long line, like the postcode list > flags nothing", () => {
    const text = `[${'"10200",'.repeat(1000)}"10300"]`;

    const findings = findHiddenCode(text, "apps/storefront/public/thai-postcodes.json");

    expect(findings).toEqual([]);
  });
});

describe("check-hidden-code command", () => {
  it("given an infected file > fails and names the file and line", () => {
    const result = runCheck({
      "clean.mjs": "export default [];\n",
      "eslint.config.mjs": `export default config;${" ".repeat(709)}${LOADER.globalO}='8-x';\n`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/eslint\.config\.mjs:1/);
    expect(result.stderr).not.toMatch(/clean\.mjs/);
  });

  it("given no file names > checks every tracked file, skipping images", () => {
    const dir = gitRepoWith({
      "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(300).fill(0x20), 0x41]),
      "postcss.config.js": `module.exports = {};${" ".repeat(3089)}${LOADER.globalO}='8-146';\n`,
      "README.md": "# Kira\n",
    });

    const result = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/postcss\.config\.js:1/);
    expect(result.stderr).not.toMatch(/logo\.png|README/);
  });

  it("given a clean project > passes and says how many files it checked", () => {
    const dir = gitRepoWith({
      "eslint.config.mjs": "export default [];\n",
      "README.md": "# Kira\n",
    });

    const result = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/No hidden code in 2 files/);
  });
});
