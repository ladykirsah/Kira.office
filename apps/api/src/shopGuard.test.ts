import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Plan 10.3 guard: every way into the server goes through its shop first. Each shop's records sit in
// their own database, so the only way to leak one shop into another is code that reaches a database,
// the settings or the stock writer WITHOUT picking the shop. These checks fail the build if anyone
// writes such a path — the two-shop tests prove the paths that exist; this keeps new ones honest.

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");

/** The text of a block, from its first line to the matching closing brace. */
function block(startsWith: string): string {
  const start = src.indexOf(startsWith);
  expect(start, `${startsWith} not found`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${startsWith} never closes`);
}

describe("shop guard > nothing reaches a database except through its shop", () => {
  it("given a request > then the Worker's own settings are used only to pick its shop", () => {
    const fetch = block("async fetch(request: Request, workerEnv: Env");
    // The parameter, the allowed app addresses, the shop list, and handing it to shopEnv — nothing
    // else. Everything after uses `env`, which is the request's shop.
    expect((fetch.match(/workerEnv(\.\w+)?/g) ?? []).sort()).toEqual([
      "workerEnv",
      "workerEnv",
      "workerEnv.ALLOWED_CORS_ORIGINS",
      "workerEnv.SHOPS",
    ]);
  });

  it("given the stock writer > then it reaches the database and settings only through its own shop", () => {
    const ledger = block("export class StockLedger");
    expect(ledger).not.toMatch(/this\.env\.(DB|KV)\b/);
  });

  it("given any route > then the stock writer it opens is its own shop's", () => {
    expect(src).not.toMatch(/idFromName\("default"\)/);
  });

  it("given the nightly jobs > then they run inside each shop, never on the Worker's own database", () => {
    const nightly = block("async scheduled(");
    expect(nightly).toMatch(/shopEnv\(workerEnv, shop\)/);
    expect(nightly).not.toMatch(/workerEnv\.(DB|KV)\b/);
  });
});
