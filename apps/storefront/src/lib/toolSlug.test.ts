import { describe, it, expect } from "vitest";
import { toolCategorySlug, matchCategorySlug } from "./toolSlug";

describe("toolCategorySlug", () => {
  it("given an english name > lowercases and dashes it", () => {
    expect(toolCategorySlug("Gauges")).toBe("gauges");
    expect(toolCategorySlug("Vacuum Pumps")).toBe("vacuum-pumps");
  });

  it("given surrounding or doubled spaces > produces one clean dash", () => {
    expect(toolCategorySlug("  Hand   Tools  ")).toBe("hand-tools");
  });

  it("given a thai name > keeps the thai, so the URL still reads as the category", () => {
    expect(toolCategorySlug("เกจวัดน้ำยา")).toBe("เกจวัดน้ำยา");
  });

  it("given punctuation > drops it rather than percent-encoding noise into the URL", () => {
    expect(toolCategorySlug("น้ำยา & อะไหล่")).toBe("น้ำยา-อะไหล่");
  });

  it("given a name that slugs to nothing > returns empty, so callers can fall back", () => {
    expect(toolCategorySlug("///")).toBe("");
  });
});

describe("matchCategorySlug", () => {
  const names = ["Gauges", "Vacuum Pumps", "เกจวัดน้ำยา"];

  it("finds the category a slug came from", () => {
    expect(matchCategorySlug(names, "vacuum-pumps")).toBe("Vacuum Pumps");
    expect(matchCategorySlug(names, "เกจวัดน้ำยา")).toBe("เกจวัดน้ำยา");
  });

  it("given a decoded slug from the URL bar > still matches", () => {
    expect(matchCategorySlug(names, decodeURIComponent("%E0%B9%80%E0%B8%81%E0%B8%88"))).toBe(null);
    expect(matchCategorySlug(names, "GAUGES")).toBe("Gauges");
  });

  it("given an unknown slug > returns null so the page can 404", () => {
    expect(matchCategorySlug(names, "compressors")).toBe(null);
  });
});
