import { describe, it, expect } from "vitest";
import { renderTerms } from "./terms";

describe("renderTerms (Thai)", () => {
  it("fills known placeholders", () => {
    const out = renderTerms("สินค้า: {{product_name}} แบรนด์: {{brand}}", {
      product_name: "ครีมบำรุงผิว",
      brand: "ABC",
    });
    expect(out).toBe("สินค้า: ครีมบำรุงผิว แบรนด์: ABC");
  });

  it("allows whitespace inside braces", () => {
    expect(renderTerms("{{ name }}", { name: "X" })).toBe("X");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderTerms("{{a}}-{{b}}", { a: "1" })).toBe("1-{{b}}");
  });
});
