import { describe, it, expect } from "vitest";
import { parseWarrantyDays, validateAttributeName } from "./categoryForm";

describe("parseWarrantyDays", () => {
  it("given an empty string > returns null (no warranty shown)", () => {
    expect(parseWarrantyDays("")).toBeNull();
  });

  it("given only whitespace > returns null", () => {
    expect(parseWarrantyDays("   ")).toBeNull();
  });

  it("given a plain number > returns it", () => {
    expect(parseWarrantyDays("7")).toBe(7);
  });

  it("given surrounding whitespace > still parses", () => {
    expect(parseWarrantyDays(" 30 ")).toBe(30);
  });

  it("given a decimal > rounds to whole days", () => {
    expect(parseWarrantyDays("7.6")).toBe(8);
  });

  it("given a negative number > clamps to 0", () => {
    expect(parseWarrantyDays("-5")).toBe(0);
  });

  it("given non-numeric text > returns null rather than 0", () => {
    // Regression guard: `Number("abc") || 0` would silently store 0 days, which the storefront
    // renders as a real "0 วัน" warranty. Unparseable input must mean "not set".
    expect(parseWarrantyDays("abc")).toBeNull();
  });

  it("given zero > returns 0, not null (explicitly no-warranty is a real choice)", () => {
    expect(parseWarrantyDays("0")).toBe(0);
  });
});

describe("validateAttributeName", () => {
  const existing = ["DENSO", "Sanden"];

  it("given a fresh name > is valid", () => {
    expect(validateAttributeName("Bosch", existing)).toEqual({ ok: true, value: "Bosch" });
  });

  it("given surrounding whitespace > trims before accepting", () => {
    expect(validateAttributeName("  Bosch  ", existing)).toEqual({ ok: true, value: "Bosch" });
  });

  it("given an empty value > explains what to do instead of failing silently", () => {
    // This is the reported bug: the Add button was disabled on empty input, so a click did
    // nothing at all — no request, no message. Submitting empty must now say why.
    expect(validateAttributeName("", existing)).toEqual({
      ok: false,
      error: "Type a name first.",
    });
  });

  it("given a duplicate > reports it instead of a misleading success", () => {
    // The API's addAttribute is find-or-create, so posting a duplicate returned 201 with the
    // existing row and the UI toasted "Added ✓" while the list never changed.
    expect(validateAttributeName("Sanden", existing)).toEqual({
      ok: false,
      error: "“Sanden” is already in the list.",
    });
  });

  it("given a duplicate in a different case > still reports it (API matches NOCASE)", () => {
    expect(validateAttributeName("denso", existing)).toEqual({
      ok: false,
      error: "“denso” is already in the list.",
    });
  });
});
