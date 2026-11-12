import { describe, expect, it } from "vitest";
import { insetsFromPadding, sameInsets } from "./screenInsets";

const pad = (top: string, right: string, bottom: string, left: string) => ({
  paddingTop: top,
  paddingRight: right,
  paddingBottom: bottom,
  paddingLeft: left,
});

describe("insetsFromPadding", () => {
  it("given the website saved to an iPhone home screen > then the clock and home bar come through as numbers", () => {
    expect(insetsFromPadding(pad("59px", "0px", "34px", "0px"))).toEqual({
      top: 59,
      right: 0,
      bottom: 34,
      left: 0,
    });
  });

  it("given a phone turned sideways > then the notch side comes through", () => {
    expect(insetsFromPadding(pad("0px", "0px", "21px", "62px")).left).toBe(62);
  });

  it("given a browser that leaves the padding empty > then every edge is 0", () => {
    expect(insetsFromPadding(pad("", "", "", ""))).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("sameInsets", () => {
  it("given the same four edges > then they are the same, so the page does not redraw", () => {
    expect(
      sameInsets(
        { top: 59, right: 0, bottom: 34, left: 0 },
        { top: 59, right: 0, bottom: 34, left: 0 },
      ),
    ).toBe(true);
  });

  it("given one edge changed > then they differ", () => {
    expect(
      sameInsets(
        { top: 59, right: 0, bottom: 34, left: 0 },
        { top: 0, right: 0, bottom: 21, left: 62 },
      ),
    ).toBe(false);
  });
});
