import { describe, it, expect } from "vitest";
import { mapRows } from "./imports";

describe("mapRows > tabular import normalization", () => {
  it("maps data rows to records by header name", () => {
    const r = mapRows(
      [
        ["name", "sku", "price"],
        ["Cream", "S1", "107"],
      ],
      { name: "name", sku: "sku", price: "price" },
    );
    expect(r.records).toEqual([{ name: "Cream", sku: "S1", price: "107" }]);
    expect(r.errors).toEqual([]);
  });

  it("trims values and reports rows missing a required field (1-based data index)", () => {
    const r = mapRows(
      [
        ["name", "sku"],
        ["  Cream  ", "S1"],
        ["", "S2"],
      ],
      { name: "name", sku: "sku" },
      ["name"],
    );
    expect(r.records).toEqual([{ name: "Cream", sku: "S1" }]);
    expect(r.errors).toEqual([{ rowIndex: 2, reason: "missing required field: name" }]);
  });

  it("throws when a mapped header column is absent", () => {
    expect(() => mapRows([["name"]], { sku: "sku" })).toThrow(/missing column: sku/i);
  });

  it("returns empty for no rows", () => {
    expect(mapRows([], {})).toEqual({ records: [], errors: [] });
  });

  it("throws a config error when a required field is not in the mapping", () => {
    expect(() => mapRows([["name"], ["Cream"]], { name: "name" }, ["sku"])).toThrow(
      /required field not mapped: sku/i,
    );
  });
});
