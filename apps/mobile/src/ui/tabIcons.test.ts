import { PRIMARY_TABS } from "@l-shopee/shared/nav";
import { describe, expect, it } from "vitest";
import { TAB_ICONS } from "./tabIcons";

describe("TAB_ICONS", () => {
  it("given the bottom bar's tabs > then every tab has a line icon", () => {
    const missing = PRIMARY_TABS.filter((tab) => !TAB_ICONS[tab.href]);
    expect(missing.map((tab) => tab.href)).toEqual([]);
  });
});
