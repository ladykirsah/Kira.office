import { describe, it, expect } from "vitest";
import { collapseToSingleDefault } from "./addresses";

const row = (id: string, isDefault: boolean) => ({ id, isDefault });

describe("collapseToSingleDefault", () => {
  it("given more than one default > keeps only the first (latest) as default", () => {
    const out = collapseToSingleDefault([row("a", true), row("b", true), row("c", false)]);
    expect(out.map((r) => r.isDefault)).toEqual([true, false, false]);
  });

  it("given exactly one default > leaves it as the default", () => {
    const out = collapseToSingleDefault([row("a", false), row("b", true)]);
    expect(out.map((r) => r.isDefault)).toEqual([false, true]);
  });

  it("given no default > leaves every row non-default", () => {
    const out = collapseToSingleDefault([row("a", false), row("b", false)]);
    expect(out.map((r) => r.isDefault)).toEqual([false, false]);
  });

  it("preserves row order and all other fields", () => {
    const out = collapseToSingleDefault([
      { id: "a", isDefault: true, phone: "x" },
      { id: "b", isDefault: true, phone: "y" },
    ]);
    expect(out).toEqual([
      { id: "a", isDefault: true, phone: "x" },
      { id: "b", isDefault: false, phone: "y" },
    ]);
  });
});
