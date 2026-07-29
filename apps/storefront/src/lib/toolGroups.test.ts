import { describe, it, expect } from "vitest";
import { groupToolsByCategory, SECTION_CARDS } from "./toolGroups";

const card = (id: string, categoryName: string | null, clicks = 0) => ({
  id,
  title: id,
  imageKey: null,
  priceText: null,
  source: "shopee",
  categoryName,
  clicks,
});

describe("groupToolsByCategory", () => {
  it("groups the cards into one section per category", () => {
    const sections = groupToolsByCategory([
      card("a", "Gauges"),
      card("b", "Pumps"),
      card("c", "Gauges"),
    ]);
    expect(sections.map((s) => s.name)).toEqual(["Gauges", "Pumps"]);
    expect(sections[0].items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("orders the sections by total clicks, busiest first", () => {
    const sections = groupToolsByCategory([
      card("quiet", "Pumps", 5),
      card("busy1", "Gauges", 40),
      card("busy2", "Gauges", 10),
      card("mid", "Tools", 60),
    ]);
    // Gauges 50 > Tools 60? no — Tools is 60, Gauges 50, Pumps 5.
    expect(sections.map((s) => s.name)).toEqual(["Tools", "Gauges", "Pumps"]);
  });

  it("given equal clicks > falls back to the category name, so the order never wobbles", () => {
    const sections = groupToolsByCategory([card("b", "Pumps", 0), card("a", "Gauges", 0)]);
    expect(sections.map((s) => s.name)).toEqual(["Gauges", "Pumps"]);
  });

  it("drops cards with no category — the owner chose to hide them until filed", () => {
    const sections = groupToolsByCategory([card("loose", null, 99), card("filed", "Gauges")]);
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe("Gauges");
  });

  it("caps each section at SECTION_CARDS but reports the true total for ดูทั้งหมด", () => {
    const many = Array.from({ length: SECTION_CARDS + 4 }, (_, i) => card(`i${i}`, "Gauges"));
    const [gauges] = groupToolsByCategory(many);
    expect(gauges.items).toHaveLength(SECTION_CARDS);
    expect(gauges.total).toBe(SECTION_CARDS + 4);
  });

  it("gives every section the slug its category page lives at", () => {
    const [section] = groupToolsByCategory([card("a", "Vacuum Pumps")]);
    expect(section.slug).toBe("vacuum-pumps");
  });

  it("given only unfiled cards > returns no sections, so the page shows its empty state", () => {
    expect(groupToolsByCategory([card("a", null)])).toEqual([]);
  });
});
