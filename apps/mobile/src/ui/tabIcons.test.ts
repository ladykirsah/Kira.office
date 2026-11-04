import { PRIMARY_TABS, navGroupsFor } from "@l-shopee/shared/nav";
import { describe, expect, it } from "vitest";
import { PAGE_ICONS, TAB_ICONS } from "./tabIcons";

describe("PAGE_ICONS (☰ menu, design C)", () => {
  it("given every page in the owner's menu > then each has a line icon, like the bottom bar", () => {
    const links = navGroupsFor("super_admin").flatMap((g) => g.links);
    const missing = links.filter((l) => !PAGE_ICONS[l.href]).map((l) => l.href);

    expect(links).toHaveLength(20);
    expect(missing).toEqual([]);
  });

  it("given หน้าหลัก > then it has a line icon too", () => {
    expect(PAGE_ICONS["/"]).toBeTruthy();
  });
});

describe("TAB_ICONS", () => {
  it("given the bottom bar's tabs > then every tab has a line icon", () => {
    const missing = PRIMARY_TABS.filter((tab) => !TAB_ICONS[tab.href]);
    expect(missing.map((tab) => tab.href)).toEqual([]);
  });
});
