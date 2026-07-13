import { describe, it, expect } from "vitest";
import { suggestionPool, rerankByInterest, type PoolItem } from "./suggest";

const p = (variantId: string, productId: string, typeName: string | null = null): PoolItem => ({
  variantId,
  productId,
  typeName,
});

describe("suggestionPool", () => {
  it("orders on-sale first, then best-sellers, then latest", () => {
    const pool = suggestionPool([p("s1", "s1")], [p("b1", "b1")], [p("l1", "l1")]);
    expect(pool.map((x) => x.variantId)).toEqual(["s1", "b1", "l1"]);
  });

  it("de-dupes across the three lists by variantId (first occurrence wins its position)", () => {
    const pool = suggestionPool(
      [p("a", "a")],
      [p("a", "a"), p("b", "b")],
      [p("b", "b"), p("c", "c")],
    );
    expect(pool.map((x) => x.variantId)).toEqual(["a", "b", "c"]);
  });

  it("caps the pool", () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`v${i}`, `v${i}`));
    expect(suggestionPool(many, [], [], 16)).toHaveLength(16);
  });
});

describe("rerankByInterest", () => {
  const pool = [
    p("a", "pA", "คอมเพรสเซอร์"),
    p("b", "pB", "คอยล์เย็น"),
    p("c", "pC", "แผงร้อน"),
    p("d", "pD", "คอยล์เย็น"),
  ];

  it("surfaces items whose type matches an interested type, keeping the rest after", () => {
    const out = rerankByInterest(pool, [], ["คอยล์เย็น"], 6);
    expect(out.map((x) => x.variantId)).toEqual(["b", "d", "a", "c"]);
  });

  it("when enough not-viewed items exist, already-viewed ones do not appear", () => {
    const bigger = [...pool, p("e", "pE", "คอมเพรสเซอร์"), p("f", "pF", "แผงร้อน")];
    const out = rerankByInterest(bigger, ["pB"], ["คอยล์เย็น"], 3);
    expect(out.map((x) => x.productId)).not.toContain("pB");
    expect(out).toHaveLength(3);
  });

  it("deprioritizes already-viewed items to the end (used only as filler to keep the grid full)", () => {
    const out = rerankByInterest(pool, ["pB"], ["คอยล์เย็น"], 6);
    // not-viewed (interested first) lead; the viewed pB is appended last, not dropped
    expect(out.map((x) => x.variantId)).toEqual(["d", "a", "c", "b"]);
  });

  it("caps the result", () => {
    expect(rerankByInterest(pool, [], ["คอยล์เย็น"], 2)).toHaveLength(2);
  });

  it("given every candidate was already viewed > falls back to the pool head (never empty)", () => {
    const out = rerankByInterest(pool, ["pA", "pB", "pC", "pD"], ["คอยล์เย็น"], 3);
    expect(out.map((x) => x.variantId)).toEqual(["a", "b", "c"]);
  });

  it("given no interested types > not-viewed items in pool order (viewed appended as filler)", () => {
    expect(rerankByInterest(pool, ["pA"], [], 3).map((x) => x.variantId)).toEqual(["b", "c", "d"]);
    expect(rerankByInterest(pool, ["pA"], [], 6).map((x) => x.variantId)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });
});
