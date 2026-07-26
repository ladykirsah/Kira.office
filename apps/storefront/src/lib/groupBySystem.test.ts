import { describe, it, expect } from "vitest";
import { groupCategoriesBySystem, type CategoryRow } from "./groupBySystem";

const cat = (over: Partial<CategoryRow> & Pick<CategoryRow, "id" | "name">): CategoryRow => ({
  nameTh: null,
  nameEn: null,
  productCount: 0,
  imageKey: null,
  usageId: null,
  systemName: null,
  systemNameTh: null,
  systemNameEn: null,
  ...over,
});

describe("groupCategoriesBySystem", () => {
  it("groups categories under their car system, systems in first-seen order", () => {
    const rows = [
      cat({
        id: "t1",
        name: "Evaporator",
        usageId: "u-ac",
        systemName: "A/C",
        systemNameTh: "แอร์",
      }),
      cat({
        id: "t2",
        name: "Condenser",
        usageId: "u-ac",
        systemName: "A/C",
        systemNameTh: "แอร์",
      }),
      cat({
        id: "t3",
        name: "Timing belt",
        usageId: "u-eng",
        systemName: "Engine",
        systemNameTh: "เครื่องยนต์",
      }),
    ];
    const groups = groupCategoriesBySystem(rows);
    expect(groups.map((g) => g.system?.name)).toEqual(["A/C", "Engine"]);
    expect(groups[0].categories.map((c) => c.id)).toEqual(["t1", "t2"]);
    expect(groups[0].system).toEqual({ id: "u-ac", name: "A/C", nameTh: "แอร์", nameEn: null });
    expect(groups[1].categories.map((c) => c.id)).toEqual(["t3"]);
  });

  it("keeps a system's categories together even if the input interleaves them", () => {
    const rows = [
      cat({ id: "t1", name: "Evaporator", usageId: "u-ac", systemName: "A/C" }),
      cat({ id: "t3", name: "Timing belt", usageId: "u-eng", systemName: "Engine" }),
      cat({ id: "t2", name: "Condenser", usageId: "u-ac", systemName: "A/C" }),
    ];
    const groups = groupCategoriesBySystem(rows);
    expect(groups.map((g) => g.system?.name)).toEqual(["A/C", "Engine"]);
    expect(groups[0].categories.map((c) => c.id)).toEqual(["t1", "t2"]);
  });

  it("puts unlinked categories (no car system) in a trailing null-system group", () => {
    const rows = [
      cat({ id: "t1", name: "Evaporator", usageId: "u-ac", systemName: "A/C" }),
      cat({ id: "t9", name: "Loose part", usageId: null }),
    ];
    const groups = groupCategoriesBySystem(rows);
    expect(groups.map((g) => g.system?.name ?? null)).toEqual(["A/C", null]);
    expect(groups[1].system).toBeNull();
    expect(groups[1].categories.map((c) => c.id)).toEqual(["t9"]);
  });

  it("a single system yields one group", () => {
    const rows = [
      cat({ id: "t1", name: "Evaporator", usageId: "u-ac", systemName: "A/C" }),
      cat({ id: "t2", name: "Condenser", usageId: "u-ac", systemName: "A/C" }),
    ];
    expect(groupCategoriesBySystem(rows)).toHaveLength(1);
  });

  it("empty input yields no groups", () => {
    expect(groupCategoriesBySystem([])).toEqual([]);
  });
});
