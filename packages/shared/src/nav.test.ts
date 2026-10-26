import { describe, it, expect } from "vitest";
import { NAV_GROUPS, PRIMARY_TABS, activeHref, navGroupsFor, nextBarVisible } from "./nav";
import type { StaffRole } from "@l-shopee/core";

const allHrefs = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));

describe("NAV_GROUPS", () => {
  it("groups every page by the job it does, in the owner's order (2026-08-03)", () => {
    expect(NAV_GROUPS.map((g) => [g.section.en, g.links.map((l) => l.label.en)])).toEqual([
      ["Daily Uses", ["Scan here", "AirPlus Orders", "Point of Sale", "Payment", "Customers"]],
      ["Stock", ["Products", "Add product", "Barcodes", "Stock movements"]],
      ["AirPlus Marketing", ["Insight", "Affiliate Promote", "Banners", "Coupons", "Flash sales"]],
      [
        "Overall management",
        ["Shop info", "Staff", "Finance", "Service Setup", "Part setup", "Car fitment", "Terms"],
      ],
    ]);
  });

  it("lists no page twice", () => {
    expect(new Set(allHrefs).size).toBe(allHrefs.length);
  });

  /**
   * The menu is on every screen, so a nav entry that was never translated is the most visible
   * possible half-finished job (owner, 2026-08-25). Adding a page and writing only the English is
   * the easy mistake; this is what catches it.
   */
  it("says every entry in both languages", () => {
    const missing = NAV_GROUPS.flatMap((g) => [
      ...(g.section.th.trim() && g.section.en.trim() ? [] : [`section ${g.section.en}`]),
      ...g.links.flatMap((l) => [
        ...(l.label.th.trim() && l.label.en.trim() ? [] : [l.href]),
        ...(l.short === undefined || (l.short.th.trim() && l.short.en.trim())
          ? []
          : [`${l.href} (short)`]),
      ]),
    ]);
    expect(missing).toEqual([]);
  });
});

describe("PRIMARY_TABS", () => {
  it("is exactly the owner's four daily pages, in their order", () => {
    expect(PRIMARY_TABS.map((t) => t.href)).toEqual(["/scan", "/customers", "/pos", "/payment"]);
  });

  it("only names pages that exist in the menu", () => {
    for (const tab of PRIMARY_TABS) expect(allHrefs).toContain(tab.href);
  });
});

describe("activeHref", () => {
  it("given the exact path > marks that link", () => {
    expect(activeHref("/products")).toBe("/products");
  });

  it("given a sub-route > marks its parent", () => {
    expect(activeHref("/customers/1กก-1234")).toBe("/customers");
  });

  it("given two candidates > the most specific wins", () => {
    // /products/new must not also light /products
    expect(activeHref("/products/new")).toBe("/products/new");
  });

  it("given an unknown path > marks nothing", () => {
    expect(activeHref("/nowhere")).toBeUndefined();
  });
});

describe("nextBarVisible", () => {
  it("near the top of the page > always shown", () => {
    expect(nextBarVisible({ y: 300, visible: false }, 10)).toBe(true);
  });

  it("scrolling down > hides the bar", () => {
    expect(nextBarVisible({ y: 200, visible: true }, 260)).toBe(false);
  });

  it("scrolling back up > shows it again", () => {
    expect(nextBarVisible({ y: 400, visible: false }, 340)).toBe(true);
  });

  it("a jitter smaller than the threshold > leaves it as it was", () => {
    expect(nextBarVisible({ y: 400, visible: true }, 404)).toBe(true);
    expect(nextBarVisible({ y: 400, visible: false }, 396)).toBe(false);
  });
});

describe("navGroupsFor", () => {
  const hrefs = (role: StaffRole) => navGroupsFor(role).flatMap((g) => g.links.map((l) => l.href));

  it("a super admin sees everything, including Staff", () => {
    expect(hrefs("super_admin")).toEqual(NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href)));
    expect(hrefs("super_admin")).toContain("/settings/staff");
  });

  it("an admin loses Finance, Staff and Insight, and keeps the rest", () => {
    const admin = hrefs("admin");
    expect(admin).not.toContain("/sales");
    expect(admin).not.toContain("/settings/staff");
    // Insight leads with profit and margin — the same books /sales is withheld for.
    expect(admin).not.toContain("/insights");
    expect(admin).toContain("/orders");
    expect(admin).toContain("/settings/coupons");
    expect(admin).toContain("/settings/shop");
  });

  it("a mechanic sees only their own work", () => {
    expect(hrefs("mechanic")).toEqual([
      "/scan",
      "/orders",
      "/pos",
      "/payment",
      "/customers",
      "/products",
      "/stock",
    ]);
  });

  it("drops a section that ends up empty rather than leaving a bare heading", () => {
    // A mechanic gets nothing from Marketing or Overall management; those headings must not survive.
    const sections = navGroupsFor("mechanic").map((g) => g.section.en);
    expect(sections).toEqual(["Daily Uses", "Stock"]);
  });

  it("never invents a link that isn't in the one menu definition", () => {
    const all = new Set(NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href)));
    for (const role of ["super_admin", "admin", "mechanic"] as StaffRole[]) {
      for (const href of hrefs(role)) expect(all.has(href)).toBe(true);
    }
  });
});
