/**
 * Refuses any tracked file that hides code the way the October 2026 loader did: appended to an
 * ordinary-looking line behind hundreds of spaces, so every diff view shows a short config file.
 * It reached `main` as a forged force-push (17 Oct) and ran from both ESLint configs on every lint
 * and every `next build` — see docs/knowledge/operations/incidents-log.md.
 *
 * Zero dependencies on purpose: CI runs this BEFORE `npm ci`, so nothing from node_modules and no
 * project config executes until it has passed.
 *
 *   node scripts/check-hidden-code.mjs            every tracked file
 *   node scripts/check-hidden-code.mjs a.js b.ts  just these
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Measured on the clean tree (25 Oct 2026): the longest run of spaces in any file is 50 and the
// longest line of code 2,862 (faq.ts). The planted line used 709 spaces and ran to 6,780 chars;
// the copy that rewrote npm's cli.js was one 62,591-char line.
const SPACE_RUN_LIMIT = 100;
const CODE_LINE_LIMIT = 5000;

const HIDDEN_AFTER_SPACES = new RegExp(` {${SPACE_RUN_LIMIT},}\\S`);
const CODE_FILE = /\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$/;
// Strings the obfuscator emits whatever it is hiding; one match is enough.
const LOADER_FINGERPRINTS = [
  /global\.o\s*=\s*['"]/,
  /_\$_[0-9a-f]{4}\s*=\s*\(function/,
  /String\.fromCharCode\(127\)/,
];

export function findHiddenCode(text, path) {
  const isCode = CODE_FILE.test(path);
  const findings = [];
  text.split("\n").forEach((content, index) => {
    const line = index + 1;
    if (HIDDEN_AFTER_SPACES.test(content)) {
      findings.push({ line, rule: "hidden-after-spaces" });
    } else if (LOADER_FINGERPRINTS.some((pattern) => pattern.test(content))) {
      findings.push({ line, rule: "loader-fingerprint" });
    } else if (isCode && content.length > CODE_LINE_LIMIT) {
      findings.push({ line, rule: "very-long-line" });
    }
  });
  return findings;
}

const REASONS = {
  "hidden-after-spaces": `code hidden after ${SPACE_RUN_LIMIT}+ spaces`,
  "loader-fingerprint": "matches the loader planted in October 2026",
  "very-long-line": `one line of code longer than ${CODE_LINE_LIMIT} characters`,
};

// Skipped by name: their bytes are not lines of text, and nothing executes them as code.
const BINARY_FILE =
  /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|avif|pdf|woff2?|ttf|otf|eot|zip|gz|mp3|mp4|mov|webm|sqlite|xlsx)$/i;

function trackedFiles() {
  const listing = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  if (listing.status !== 0) {
    throw new Error(`git ls-files failed: ${listing.stderr}`);
  }
  return listing.stdout.split("\0").filter((path) => path && !BINARY_FILE.test(path));
}

function checkFiles(paths) {
  const problems = [];
  for (const path of paths) {
    const text = readFileSync(path, "utf8");
    for (const finding of findHiddenCode(text, path)) {
      problems.push(`${path}:${finding.line}  ${REASONS[finding.rule]}`);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const named = process.argv.slice(2);
  const files = named.length > 0 ? named : trackedFiles();
  const problems = checkFiles(files);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`No hidden code in ${files.length} files.`);
}
