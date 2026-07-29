import { describe, it, expect } from "vitest";
import { groupAffiliateItems, nextSortOrder } from "./affiliateGroups";

const item = (title: string, categoryName: string | null, pinned = 0) => ({
  id: title,
  title,
  categoryId: categoryName,
  categoryName,
  pinned,
});

describe("groupAffiliateItems", () => {
  it("groups the cards under their category, alphabetically", () => {
    const groups = groupAffiliateItems([
      item("Vacuum pump", "Pumps"),
      item("Manifold gauge", "Gauges"),
      item("Micron gauge", "Gauges"),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Gauges", "Pumps"]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["Manifold gauge", "Micron gauge"]);
  });

  it("keeps the order the list arrived in within a group", () => {
    const groups = groupAffiliateItems([item("B", "Tools"), item("A", "Tools")]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["B", "A"]);
  });

  it("puts uncategorised cards in their own group, last", () => {
    const groups = groupAffiliateItems([item("Loose", null), item("Filed", "Gauges")]);
    expect(groups.map((g) => g.name)).toEqual(["Gauges", "Uncategorised"]);
    expect(groups[1].items[0].title).toBe("Loose");
  });

  it("given no cards > returns no groups, so the page can show its empty state", () => {
    expect(groupAffiliateItems([])).toEqual([]);
  });

  it("counts the pinned cards in each group, for the homepage badge", () => {
    const groups = groupAffiliateItems([
      item("Pinned one", "Gauges", 1),
      item("Not pinned", "Gauges", 0),
    ]);
    expect(groups[0].pinnedCount).toBe(1);
  });
});

describe("nextSortOrder", () => {
  // The owner asked why they had to type this at all — new cards now file themselves at the end.
  it("given existing cards > puts the new one after the last", () => {
    expect(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 7 }, { sortOrder: 3 }])).toBe(8);
  });

  it("given the very first card > starts at 0", () => {
    expect(nextSortOrder([])).toBe(0);
  });

  it("given negative orders > still lands after them", () => {
    expect(nextSortOrder([{ sortOrder: -5 }, { sortOrder: -2 }])).toBe(-1);
  });
});
