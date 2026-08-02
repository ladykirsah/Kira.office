import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The owner's rule (2 Aug 2026): a customer's `credit_score` and `tier` are INTERNAL to Kira.office
 * (the admin, behind Cloudflare Access). The AirPlus STOREFRONT must never expose them — a customer
 * must not be able to learn their own credit or tier.
 *
 * This is a source guard, not a runtime one: it scans the whole storefront source and fails the
 * moment either the credit-score column or the tier column is referenced anywhere — the only way to
 * leak them to a customer is to read those columns in a storefront route/page, so forbidding the
 * strings outright is a strict, false-negative-proof fence. Neither appears today.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const PATTERNS = [
  { name: "credit_score / creditScore", re: /credit[_]?score/i },
  { name: "tier", re: /\btier\b/i },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    // Skip test files (this guard names the forbidden strings itself, and tests are not shipped code).
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("storefront never exposes customer credit/tier (admin-only invariant)", () => {
  it("no storefront source file references credit_score or tier", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const p of PATTERNS) {
        if (p.re.test(text)) offenders.push(`${file.slice(SRC.length + 1)} → ${p.name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the guard is not vacuous — its patterns catch a real leak", () => {
    const leak = "SELECT c.credit_score AS creditScore, c.tier FROM storefront_customers";
    expect(PATTERNS.some((p) => p.re.test(leak))).toBe(true);
  });
});
