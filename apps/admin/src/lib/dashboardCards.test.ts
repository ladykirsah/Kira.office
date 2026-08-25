import { describe, it, expect } from "vitest";
import { DASHBOARD_CARDS } from "./dashboardCards";
import { NAV_GROUPS } from "../app/nav";

const navLabelByHref = new Map(NAV_GROUPS.flatMap((g) => g.links).map((l) => [l.href, l.label]));

describe("DASHBOARD_CARDS", () => {
  it("names a page exactly as the menu names it", () => {
    // The one that caught us: the menu said "AirPlus Orders" while the card still said "Orders".
    const mismatched = DASHBOARD_CARDS.filter((c) => {
      const navLabel = navLabelByHref.get(c.href);
      if (navLabel === undefined) return false;
      return navLabel.th !== c.title.th || navLabel.en !== c.title.en;
    }).map(
      (c) =>
        `${c.href}: card "${c.title.th}/${c.title.en}" vs menu ` +
        `"${navLabelByHref.get(c.href)?.th}/${navLabelByHref.get(c.href)?.en}"`,
    );
    expect(mismatched).toEqual([]);
  });

  it("only points at pages the menu actually has", () => {
    const unknown = DASHBOARD_CARDS.filter((c) => !navLabelByHref.has(c.href)).map((c) => c.href);
    expect(unknown).toEqual([]);
  });

  it("claims no feature the app no longer has", () => {
    // Shopee is manual now — one worklist, no import (owner, 2026-08-03). A card must not offer one.
    for (const card of DASHBOARD_CARDS) {
      expect(`${card.title} ${card.desc}`.toLowerCase()).not.toContain("shopee");
    }
  });
});
