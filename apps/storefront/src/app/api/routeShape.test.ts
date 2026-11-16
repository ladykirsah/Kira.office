import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A Response can be sent once. One made at module level and returned by every request breaks the
 * second request that gets it (bug hunt 15 Nov 2026: refund-slip's shared "Not found"). Every
 * route makes its replies inside the handler.
 */
const API_DIR = dirname(fileURLToPath(import.meta.url));

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" ? [path] : [];
  });
}

describe("AirPlus API routes", () => {
  it("no route keeps one Response at module level to return on every request", () => {
    const shared = routeFiles(API_DIR).filter((file) =>
      /^(?:export\s+)?const\s+\w+\s*=\s*(?:new\s+Response\(|Response\.(?:json|redirect)\()/m.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(shared.map((f) => relative(API_DIR, f))).toEqual([]);
  });
});
