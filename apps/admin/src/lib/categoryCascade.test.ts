import { describe, it, expect } from "vitest";
import type { Attributes } from "./api";
import {
  carSystemIdByName,
  categoryNamesForSystem,
  systemForCategory,
  systemChangePatch,
  categoryPickPatch,
} from "./categoryCascade";

/**
 * Add-product cascade: Product categories ("Part name" = product_types) are a subset of Car systems
 * (usage_categories), linked by product_types.usage_id (migration 0064). Picking a car system filters
 * the Part-name list; picking a Part name auto-fills its car system. These pure helpers hold that
 * logic so PartDetails stays a thin wiring layer.
 */
const attributes: Attributes = {
  brands: [{ id: "b1", name: "DENSO" }],
  usages: [
    { id: "u-ac", name: "A/C" },
    { id: "u-eng", name: "Engine" },
  ],
  types: [
    { id: "t-evap", name: "Evaporator", usageId: "u-ac" },
    { id: "t-cond", name: "Condenser", usageId: "u-ac" },
    { id: "t-belt", name: "Timing belt", usageId: "u-eng" },
    { id: "t-orphan", name: "Mystery", usageId: null },
  ],
  carBrands: [],
  carModels: [],
};

describe("carSystemIdByName", () => {
  it("given a known system name > returns its id (case-insensitive)", () => {
    expect(carSystemIdByName(attributes, "a/c")).toBe("u-ac");
  });
  it("given an empty or unknown name > returns null", () => {
    expect(carSystemIdByName(attributes, "  ")).toBeNull();
    expect(carSystemIdByName(attributes, "Brakes")).toBeNull();
  });
  it("given null attributes > returns null", () => {
    expect(carSystemIdByName(null, "A/C")).toBeNull();
  });
});

describe("categoryNamesForSystem", () => {
  it("given a known system > returns only that system's categories, in order", () => {
    expect(categoryNamesForSystem(attributes, "A/C")).toEqual(["Evaporator", "Condenser"]);
  });
  it("given no system selected > returns all categories (never a mystery-empty list)", () => {
    expect(categoryNamesForSystem(attributes, "")).toEqual([
      "Evaporator",
      "Condenser",
      "Timing belt",
      "Mystery",
    ]);
  });
  it("given an unknown (free-typed) system > falls back to all categories", () => {
    expect(categoryNamesForSystem(attributes, "Brakes")).toEqual([
      "Evaporator",
      "Condenser",
      "Timing belt",
      "Mystery",
    ]);
  });
  it("given null attributes > returns empty", () => {
    expect(categoryNamesForSystem(null, "A/C")).toEqual([]);
  });
});

describe("systemForCategory", () => {
  it("given a linked category > returns its car system name", () => {
    expect(systemForCategory(attributes, "Timing belt")).toBe("Engine");
  });
  it("given a category with no linked system > returns null", () => {
    expect(systemForCategory(attributes, "Mystery")).toBeNull();
  });
  it("given an unknown category > returns null", () => {
    expect(systemForCategory(attributes, "Nope")).toBeNull();
  });
});

describe("systemChangePatch", () => {
  it("switching to a system the current Part name does NOT belong to > clears the Part name", () => {
    expect(systemChangePatch(attributes, "Engine", "Evaporator")).toEqual({
      usage: "Engine",
      type: "",
    });
  });
  it("switching to the system the current Part name belongs to > keeps it", () => {
    expect(systemChangePatch(attributes, "A/C", "Evaporator")).toEqual({ usage: "A/C" });
  });
  it("a free-typed (new) Part name > is kept (it will inherit the new system on save)", () => {
    expect(systemChangePatch(attributes, "Engine", "BrandNewPart")).toEqual({ usage: "Engine" });
  });
  it("clearing the system (empty) > keeps the Part name", () => {
    expect(systemChangePatch(attributes, "", "Evaporator")).toEqual({ usage: "" });
  });
});

describe("categoryPickPatch", () => {
  it("picking a linked Part name with no system yet > auto-fills its system", () => {
    expect(categoryPickPatch(attributes, "Evaporator", "")).toEqual({
      type: "Evaporator",
      usage: "A/C",
    });
  });
  it("picking a Part name from a different system > switches the system to match", () => {
    expect(categoryPickPatch(attributes, "Timing belt", "A/C")).toEqual({
      type: "Timing belt",
      usage: "Engine",
    });
  });
  it("picking a Part name already matching the system > leaves the system alone", () => {
    expect(categoryPickPatch(attributes, "Evaporator", "A/C")).toEqual({ type: "Evaporator" });
  });
  it("typing a brand-new Part name > leaves the system alone (it inherits current on save)", () => {
    expect(categoryPickPatch(attributes, "TotallyNew", "A/C")).toEqual({ type: "TotallyNew" });
  });
});
