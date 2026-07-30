import { describe, it, expect } from "vitest";
import { OPERATIONAL_STATUSES, type OperationalStatus } from "@l-shopee/core";
import { ORDER_TAB_STATUSES, type OrderTab } from "./orderTabs";

/**
 * The /orders tabs are a partition of the operational statuses, and this is the guard that keeps it
 * one. When the vocabulary grew from 7 to 13 the tab predicates were hand-written multi-condition
 * checks, so the four new states silently belonged to no tab: they showed in "All" and nowhere else,
 * and the Unfinished count read 1 when three orders had failed. A status that lands in no tab is
 * invisible to an owner who works from the tabs.
 */
describe("ORDER_TAB_STATUSES > partition", () => {
  it("covers every operational status", () => {
    const covered = new Set(Object.values(ORDER_TAB_STATUSES).flat());
    const missing = OPERATIONAL_STATUSES.filter((s) => !covered.has(s));
    expect(missing).toEqual([]);
  });

  it("puts each status in exactly one tab", () => {
    const seen = new Map<OperationalStatus, OrderTab[]>();
    for (const [tab, statuses] of Object.entries(ORDER_TAB_STATUSES) as [
      OrderTab,
      OperationalStatus[],
    ][]) {
      for (const s of statuses) seen.set(s, [...(seen.get(s) ?? []), tab]);
    }
    const duplicated = [...seen.entries()].filter(([, tabs]) => tabs.length > 1);
    expect(duplicated).toEqual([]);
  });

  it("invents no status the core vocabulary does not have", () => {
    const known = new Set<string>(OPERATIONAL_STATUSES);
    const unknown = Object.values(ORDER_TAB_STATUSES)
      .flat()
      .filter((s) => !known.has(s));
    expect(unknown).toEqual([]);
  });
});

describe("ORDER_TAB_STATUSES > the owner's grouping", () => {
  it("Unpaid holds the whole waiting-on-money stage", () => {
    expect(ORDER_TAB_STATUSES.unpaid).toEqual(["unpaid", "verifying", "cod_pending", "cod_reject"]);
  });

  it("To ship and In transit hold exactly one status each", () => {
    expect(ORDER_TAB_STATUSES.toship).toEqual(["to_ship"]);
    expect(ORDER_TAB_STATUSES.shipped).toEqual(["in_transit"]);
  });

  it("Completed is only a cleanly finished order", () => {
    expect(ORDER_TAB_STATUSES.completed).toEqual(["complete"]);
  });

  it("Unfinished holds the failures, the bounced parcel and the whole claim lifecycle", () => {
    expect(ORDER_TAB_STATUSES.unfinished).toEqual([
      "fail",
      "return",
      "claim_pending",
      "claimed",
      "refunded",
      "claim_rejected",
    ]);
  });

  it("a claim is never counted as Completed, even though it was delivered first", () => {
    expect(ORDER_TAB_STATUSES.completed).not.toContain("claim_pending");
    expect(ORDER_TAB_STATUSES.completed).not.toContain("claimed");
  });
});
