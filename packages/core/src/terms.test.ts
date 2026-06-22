import { describe, it, expect } from "vitest";
import { renderTerms, extractPlaceholders, findMissingPlaceholders } from "./terms";

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

describe("extractPlaceholders", () => {
  it("returns unique names in first-seen order", () => {
    expect(extractPlaceholders("a {{x}} b {{y}} {{x}}")).toEqual(["x", "y"]);
  });
  it("normalizes whitespace inside braces", () => {
    expect(extractPlaceholders("{{ name }} {{name}}")).toEqual(["name"]);
  });
  it("returns empty for no placeholders", () => {
    expect(extractPlaceholders("no fields here")).toEqual([]);
  });
});

describe("findMissingPlaceholders", () => {
  it("reports placeholders with no value", () => {
    expect(findMissingPlaceholders("{{a}}-{{b}}", { a: "1" })).toEqual(["b"]);
  });
  it("treats an empty string as missing", () => {
    expect(findMissingPlaceholders("{{a}}", { a: "" })).toEqual(["a"]);
  });
  it("returns empty when all are filled", () => {
    expect(findMissingPlaceholders("{{a}}", { a: "x" })).toEqual([]);
  });
});
