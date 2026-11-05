import { describe, expect, it } from "vitest";
import {
  bandOverhang,
  bottomBar,
  pageWidth,
  phoneBottoms,
  sheetPlacement,
  SIDE_PANEL_WIDTH,
} from "./frame";

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

describe("bandOverhang", () => {
  it("given pinned buttons > then the last line needs room for the band's solid part and its fade (20 + 28)", () => {
    expect(bandOverhang(true)).toBe(48);
  });

  it("given no pinned buttons > then no band, no extra room", () => {
    expect(bandOverhang(false)).toBe(0);
  });
});

describe("sheetPlacement", () => {
  it("given a phone-size window > then a sheet rises from the bottom", () => {
    expect(sheetPlacement(390, 741)).toBe("bottom");
  });

  it("given exactly the phone limit > then it is still the phone's sheet", () => {
    expect(sheetPlacement(741, 741)).toBe("bottom");
  });

  it("given a computer window > then the sheet opens as a panel on the right (computer guide, 4 Nov)", () => {
    expect(sheetPlacement(1440, 741)).toBe("side");
    expect(SIDE_PANEL_WIDTH).toBe(440);
  });
});

describe("pageWidth", () => {
  it("given a page laid out as one column (settings, forms) > then it is 880 wide, centred (guide)", () => {
    expect(pageWidth("column")).toBe(880);
  });

  it("given a list page with a table > then it uses the full width, up to 1280", () => {
    expect(pageWidth("full")).toBe(1280);
  });
});
