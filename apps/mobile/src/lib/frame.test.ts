import { describe, expect, it } from "vitest";
import { bottomBar, phoneBottoms } from "./frame";

describe("bottomBar", () => {
  it("given a main page > then the tab bar shows", () => {
    expect(bottomBar({ back: null, search: null })).toBe("tabs");
  });

  it("given a page with a back link (a sub-page) > then there is no bar at all (owner, 29 Oct)", () => {
    expect(bottomBar({ back: { label: "ออเดอร์" }, search: null })).toBe("none");
  });

  it("given a main page that is searching > then the search field takes the bar's place", () => {
    expect(bottomBar({ back: null, search: { value: "" } })).toBe("search");
  });
});

describe("phoneBottoms", () => {
  it("given the tab bar > then the pinned buttons sit 16 above it", () => {
    expect(phoneBottoms({ bar: "tabs", insetBottom: 0, pinned: 60 }).footer).toBe(22 + 62 + 16);
  });

  it("given no bar on a phone without a home bar > then the pinned buttons sit 34 from the edge, as drawn", () => {
    expect(phoneBottoms({ bar: "none", insetBottom: 0, pinned: 60 }).footer).toBe(34);
  });

  it("given no bar on a phone with a taller home bar > then the buttons clear it", () => {
    expect(phoneBottoms({ bar: "none", insetBottom: 40, pinned: 60 }).footer).toBe(40);
  });

  it("given the tab bar > then the page leaves room for the bar and the buttons", () => {
    expect(phoneBottoms({ bar: "tabs", insetBottom: 0, pinned: 60 }).content).toBe(110 + 60);
  });

  it("given no bar > then the last card stops 16 above the pinned buttons", () => {
    expect(phoneBottoms({ bar: "none", insetBottom: 0, pinned: 120 }).content).toBe(34 + 120 + 16);
  });
});
