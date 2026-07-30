import { describe, it, expect } from "vitest";
import { CARRIERS, DEFAULT_CARRIER, trackingUrl } from "./carriers";

describe("carriers > the list", () => {
  it("Flash is the default, because it is the one AirPlus actually uses", () => {
    expect(DEFAULT_CARRIER).toBe("Flash Express");
    expect(CARRIERS).toContain(DEFAULT_CARRIER);
  });

  it("holds no duplicates — the column is plain TEXT, so a dupe would split one carrier in two", () => {
    expect(new Set(CARRIERS).size).toBe(CARRIERS.length);
  });
});

describe("carriers > tracking link", () => {
  it("given a Flash tracking number > links to Flash's own tracking page", () => {
    expect(trackingUrl("Flash Express", "TH26104508613")).toBe(
      "https://www.flashexpress.com/fle/tracking?se=TH26104508613",
    );
  });

  it("given no tracking number yet > no link", () => {
    // The normal state of an order waiting to ship: Flash issues the number at the counter, so there
    // is nothing to link to. A link built from an empty string would 404 on the carrier's site.
    expect(trackingUrl("Flash Express", null)).toBeNull();
    expect(trackingUrl("Flash Express", "")).toBeNull();
    expect(trackingUrl("Flash Express", "   ")).toBeNull();
  });

  it("given no carrier recorded > no link", () => {
    expect(trackingUrl(null, "TH26104508613")).toBeNull();
  });

  it("given a carrier we have no tracking page for > no link, rather than a broken one", () => {
    expect(trackingUrl("DHL", "TH1")).toBeNull();
    expect(trackingUrl("ตลาดนัดขนส่ง", "TH1")).toBeNull();
  });

  it("escapes the tracking number rather than pasting it into a URL", () => {
    expect(trackingUrl("Flash Express", "TH 1&x=2")).toBe(
      "https://www.flashexpress.com/fle/tracking?se=TH%201%26x%3D2",
    );
  });

  it("tolerates the padding a copy-paste from a receipt brings with it", () => {
    expect(trackingUrl("  Flash Express  ", "  TH26104508613  ")).toBe(
      "https://www.flashexpress.com/fle/tracking?se=TH26104508613",
    );
  });
});
