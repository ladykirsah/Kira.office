import { describe, it, expect } from "vitest";
import { NAV_GROUPS, PRIMARY_TABS, activeHref, nextBarVisible, pageTitle } from "./nav";

const allHrefs = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));

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

describe("pageTitle", () => {
  it("names the page you're on, for the phone top bar", () => {
    expect(pageTitle("/barcodes")).toBe("Barcodes");
    expect(pageTitle("/customers/1กก-1234")).toBe("Customers");
  });

  it("falls back to the app name off-menu", () => {
    expect(pageTitle("/")).toBe("Kira.office");
    expect(pageTitle("/nowhere")).toBe("Kira.office");
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
