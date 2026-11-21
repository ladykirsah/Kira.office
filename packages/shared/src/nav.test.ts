import { describe, it, expect } from "vitest";
import {
  NAV_GROUPS,
  PRIMARY_TABS,
  activeHref,
  navGroupsFor,
  nextBarVisible,
  pageClosed,
} from "./nav";
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
        ["Shop info", "Staff", "Finance", "Service Setup", "Part setup", "Car fitment"],
      ],
    ]);
  });

  it("names the label page ออกบาร์โค้ด, the owner's name for it (31 Oct 2026)", () => {
    const link = NAV_GROUPS.flatMap((g) => g.links).find((l) => l.href === "/barcodes");
    expect(link?.label.th).toBe("ออกบาร์โค้ด");
  });

  it("names the stock page ประวัติซื้อขาย, the owner's name for it (1 Nov 2026)", () => {
    const link = NAV_GROUPS.flatMap((g) => g.links).find((l) => l.href === "/stock");
    expect(link?.label.th).toBe("ประวัติซื้อขาย");
  });

  it("has no เงื่อนไข page: each category keeps its own in ตั้งค่าอะไหล่ (3 Nov 2026)", () => {
    expect(allHrefs).not.toContain("/terms");
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

// Plan 11.5 (20 Nov 2026): a shop without the AirPlus website (plan 10.3) no longer lists AirPlus's
// pages, and an address the menu hides says whose page it is instead of an empty frame.
const AIRPLUS_PAGES = [
  "/orders",
  "/insights",
  "/settings/affiliate-items",
  "/settings/banners",
  "/settings/coupons",
  "/settings/campaigns",
];
const DEN_AIR = { airplus: true };
const NO_AIRPLUS = { airplus: false };

describe("navGroupsFor > the shop's AirPlus website", () => {
  const hrefs = (shop: { airplus: boolean }) =>
    navGroupsFor("super_admin", shop).flatMap((g) => g.links.map((l) => l.href));

  it("navGroupsFor > given a shop without AirPlus > then none of AirPlus's pages is listed", () => {
    expect(hrefs(NO_AIRPLUS).filter((h) => AIRPLUS_PAGES.includes(h))).toEqual([]);
    expect(hrefs(NO_AIRPLUS)).toContain("/pos");
    expect(navGroupsFor("super_admin", NO_AIRPLUS).map((g) => g.section.en)).not.toContain(
      "AirPlus Marketing",
    );
  });

  it("navGroupsFor > given Den Air > then the owner keeps every AirPlus page", () => {
    for (const page of AIRPLUS_PAGES) expect(hrefs(DEN_AIR)).toContain(page);
  });
});

describe("pageClosed", () => {
  it("pageClosed > given a ช่าง on a pay page under พนักงาน > then it is the owner's page", () => {
    expect(pageClosed("mechanic", "/settings/staff/12/pay", DEN_AIR)).toBe("owner");
  });

  it("pageClosed > given a ช่าง on a new coupon > then it is for the owner and admins", () => {
    expect(pageClosed("mechanic", "/settings/coupons/new", DEN_AIR)).toBe("owner-admin");
  });

  it("pageClosed > given an admin on การเงิน's AirPlus tab > then it is the owner's page", () => {
    expect(pageClosed("admin", "/sales/airplus", DEN_AIR)).toBe("owner");
  });

  it("pageClosed > given the owner on any page > then nothing is closed", () => {
    expect(pageClosed("super_admin", "/settings/staff/12/pay", DEN_AIR)).toBeNull();
    expect(pageClosed("super_admin", "/sales/airplus", DEN_AIR)).toBeNull();
  });

  it("pageClosed > given a ช่าง on their own pages > then nothing is closed", () => {
    expect(pageClosed("mechanic", "/scan", DEN_AIR)).toBeNull();
    expect(pageClosed("mechanic", "/products/123", DEN_AIR)).toBeNull();
    expect(pageClosed("mechanic", "/", DEN_AIR)).toBeNull();
  });

  it("pageClosed > given a shop without AirPlus > then AirPlus's pages say so", () => {
    expect(pageClosed("super_admin", "/settings/coupons/new", NO_AIRPLUS)).toBe("airplus");
    expect(pageClosed("super_admin", "/orders/8", NO_AIRPLUS)).toBe("airplus");
  });

  it("pageClosed > given a ช่าง at a shop without AirPlus > then the role is named first", () => {
    expect(pageClosed("mechanic", "/settings/coupons", NO_AIRPLUS)).toBe("owner-admin");
  });

  it("pageClosed > given an address no menu page owns > then the not-found page handles it", () => {
    expect(pageClosed("mechanic", "/nowhere", DEN_AIR)).toBeNull();
  });
});
