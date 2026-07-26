import { describe, it, expect } from "vitest";
import { missingRequiredToSave, shouldAutosaveDraft } from "./newProduct";

const base = {
  busy: false,
  name: "Evaporator",
  productRef: "TG-1",
  hasAutosavedId: false,
  refInUse: false,
  signature: "a",
  lastSavedSignature: "",
};

describe("shouldAutosaveDraft", () => {
  it("saves when required fields are present and something changed", () => {
    expect(shouldAutosaveDraft(base)).toBe(true);
  });

  it("does not save while a publish is in flight", () => {
    expect(shouldAutosaveDraft({ ...base, busy: true })).toBe(false);
  });

  it("does not save until both required fields exist", () => {
    expect(shouldAutosaveDraft({ ...base, productRef: "" })).toBe(false);
  });

  it("does not re-save when nothing changed since the last draft", () => {
    expect(shouldAutosaveDraft({ ...base, signature: "x", lastSavedSignature: "x" })).toBe(false);
  });

  it("first save must NOT land on an in-use Product ID (no clobber of another product)", () => {
    expect(shouldAutosaveDraft({ ...base, hasAutosavedId: false, refInUse: true })).toBe(false);
  });

  it("once we own a draft row, an in-use match is our own draft — keep saving by id", () => {
    expect(shouldAutosaveDraft({ ...base, hasAutosavedId: true, refInUse: true })).toBe(true);
  });
});

describe("missingRequiredToSave", () => {
  it("given both a name and a Product ID > returns null (nothing blocks save)", () => {
    expect(missingRequiredToSave({ name: "Evaporator", productRef: "TG-1" })).toBeNull();
  });

  it("given neither > names both in one message, no fixed order", () => {
    expect(missingRequiredToSave({ name: "  ", productRef: "" })).toBe(
      "Enter a product name and a Product ID to save.",
    );
  });

  it("given only the name missing > asks for the name only", () => {
    expect(missingRequiredToSave({ name: "", productRef: "TG-1" })).toBe(
      "Enter a product name to save.",
    );
  });

  it("given only the Product ID missing > asks for the Product ID only", () => {
    expect(missingRequiredToSave({ name: "Evaporator", productRef: "  " })).toBe(
      "Enter a Product ID to save.",
    );
  });
});
