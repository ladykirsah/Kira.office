import { describe, expect, it, vi } from "vitest";
import * as worker from "./index";

// `cloudflare:workers` only exists inside the Workers runtime; stand in its DurableObject base.
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }));

/**
 * The Cloudflare runtime reads every named export of the Worker's main file as a handler: a
 * function, a class or an object. A plain number, word or true/false there stops the Worker from
 * starting — the local server died on `export const LIST_LIMIT = 5000` (plan 8.5, 16 Nov 2026), and
 * a deploy would fail the same way. Keep such values unexported (lists and objects are fine).
 */
describe("worker main file > named exports", () => {
  it("given the runtime loads every export > then none is a plain number, word or true/false", () => {
    const plainValues = Object.entries(worker)
      .filter(([, value]) => value === null || !["function", "object"].includes(typeof value))
      .map(([name]) => name);
    expect(plainValues).toEqual([]);
  });
});
