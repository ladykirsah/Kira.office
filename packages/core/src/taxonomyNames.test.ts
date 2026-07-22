import { describe, it, expect } from "vitest";
import { hasThaiScript, splitLegacyName, displayNames } from "./taxonomyNames";

describe("hasThaiScript", () => {
  it("given Thai text > true", () => {
    expect(hasThaiScript("คอยล์เย็น")).toBe(true);
  });

  it("given English text > false", () => {
    expect(hasThaiScript("Cabin blower resistor")).toBe(false);
  });

  it("given mixed text > true, because the Thai part is what we key on", () => {
    expect(hasThaiScript("คอมเพรสเซอร์ DENSO")).toBe(true);
  });

  it("given a brand with digits and punctuation > false", () => {
    expect(hasThaiScript("Mercedes-Benz 2024")).toBe(false);
  });

  it("given empty > false", () => {
    expect(hasThaiScript("")).toBe(false);
  });
});

describe("splitLegacyName", () => {
  // Backfill: every existing row has ONE `name` in an unknown language. Which column it belongs in
  // is decided by script, which is unambiguous for Thai vs Latin.
  it("given a Thai legacy name > files it as the Thai name", () => {
    expect(splitLegacyName("คอยล์เย็น")).toEqual({ nameTh: "คอยล์เย็น", nameEn: null });
  });

  it("given an English legacy name > files it as the English name", () => {
    expect(splitLegacyName("Evaporator")).toEqual({ nameTh: null, nameEn: "Evaporator" });
  });

  it("given surrounding whitespace > trims before deciding", () => {
    expect(splitLegacyName("  Toyota  ")).toEqual({ nameTh: null, nameEn: "Toyota" });
  });

  it("given an empty name > files neither", () => {
    expect(splitLegacyName("   ")).toEqual({ nameTh: null, nameEn: null });
  });
});

describe("displayNames", () => {
  it("given both names > Thai headline, English sub-line", () => {
    expect(displayNames({ name: "Toyota", nameTh: "โตโยต้า", nameEn: "Toyota" })).toEqual({
      th: "โตโยต้า",
      en: "Toyota",
    });
  });

  it("given only a legacy English name > shows it once, with no sub-line", () => {
    // The owner has not supplied a Thai name yet. Repeating the same string on both lines would
    // look like a rendering bug, so the second line is dropped.
    expect(displayNames({ name: "Cabin blower resistor", nameTh: null, nameEn: null })).toEqual({
      th: "Cabin blower resistor",
      en: null,
    });
  });

  it("given a legacy English name echoed into nameEn > still shows one line", () => {
    // This is exactly what the backfill produces for an English-only row.
    expect(displayNames({ name: "Condenser", nameTh: null, nameEn: "Condenser" })).toEqual({
      th: "Condenser",
      en: null,
    });
  });

  it("given only a Thai name > shows it once, with no sub-line", () => {
    expect(displayNames({ name: "คอยล์เย็น", nameTh: "คอยล์เย็น", nameEn: null })).toEqual({
      th: "คอยล์เย็น",
      en: null,
    });
  });

  it("given the owner later adds Thai to an English row > Thai leads, English drops to the sub-line", () => {
    expect(
      displayNames({
        name: "Cabin blower resistor",
        nameTh: "รีซิสเตอร์พัดลมแอร์",
        nameEn: "Cabin blower resistor",
      }),
    ).toEqual({ th: "รีซิสเตอร์พัดลมแอร์", en: "Cabin blower resistor" });
  });

  it("given a Thai name but only the legacy English in `name` > uses the legacy as the sub-line", () => {
    // Mirrors today's car-brand behaviour: name='Toyota' is English, nameTh supplies the headline.
    expect(displayNames({ name: "Toyota", nameTh: "โตโยต้า", nameEn: null })).toEqual({
      th: "โตโยต้า",
      en: "Toyota",
    });
  });

  it("given blank strings rather than nulls > treats them as absent", () => {
    // The admin form posts "" for an untouched field; that must not render an empty grey line.
    expect(displayNames({ name: "Evaporator", nameTh: "  ", nameEn: "" })).toEqual({
      th: "Evaporator",
      en: null,
    });
  });
});
