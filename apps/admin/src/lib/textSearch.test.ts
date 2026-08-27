import { describe, it, expect } from "vitest";
import { matchesText, equalsText } from "./textSearch";

describe("matchesText", () => {
  it("given the query sits in the second field > then matches", () =>
    expect(matchesText("compressor", "AC-CMP-01", "Denso compressor")).toBe(true));

  it("given the query is nowhere > then does not match", () =>
    expect(matchesText("evaporator", "AC-CMP-01", "Denso compressor")).toBe(false));

  it("given a different case > then still matches", () =>
    expect(matchesText("DENSO", "AC-CMP-01", "Denso compressor")).toBe(true));

  it("given spaces around the query > then still matches", () =>
    expect(matchesText("  denso  ", "AC-CMP-01", "Denso compressor")).toBe(true));

  it("given an empty query > then matches, because a filter with no term filters nothing", () =>
    expect(matchesText("", "AC-CMP-01", "Denso compressor")).toBe(true));

  /**
   * THE BUG THIS EXISTS FOR. A product saved before the Product ID became mandatory has none, and
   * every picker that reached straight for `.toLowerCase()` took the whole screen down with it.
   */
  it("given a product with no Product ID > then searches the name instead of throwing", () => {
    expect(matchesText("denso", null, "Denso compressor")).toBe(true);
    expect(matchesText("AC-CMP", null, "Denso compressor")).toBe(false);
    expect(matchesText("denso", undefined, "Denso compressor")).toBe(true);
  });

  it("given every field is missing > then nothing matches and nothing throws", () =>
    expect(matchesText("denso", null, null)).toBe(false));
});

describe("equalsText", () => {
  it("given the exact code > then matches", () =>
    expect(equalsText("AC-CMP-01", "AC-CMP-01")).toBe(true));

  it("given a different case or stray spaces > then still matches", () => {
    expect(equalsText(" ac-cmp-01 ", "AC-CMP-01")).toBe(true);
    expect(equalsText("AC-CMP-01", " ac-cmp-01 ")).toBe(true);
  });

  it("given only PART of the code > then does not match, unlike a search", () =>
    expect(equalsText("AC-CMP", "AC-CMP-01")).toBe(false));

  it("given nothing typed > then finds nothing, because a lookup needs something to look up", () =>
    expect(equalsText("", "AC-CMP-01")).toBe(false));

  /** The till: scanning a code must never take the sale down over a product with no Product ID. */
  it("given a product with no Product ID > then it is simply not the one, and nothing throws", () => {
    expect(equalsText("AC-CMP-01", null)).toBe(false);
    expect(equalsText("AC-CMP-01", undefined)).toBe(false);
  });
});
