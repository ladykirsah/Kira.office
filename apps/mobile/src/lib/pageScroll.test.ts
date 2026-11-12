import { describe, expect, it } from "vitest";
import { pinnedPosition, scrollsWithPage } from "./pageScroll";

describe("scrollsWithPage", () => {
  it("given the website on a phone > then the whole page scrolls, so Safari shows it under its bars", () => {
    expect(scrollsWithPage("web", true)).toBe(true);
  });

  it("given the website on a computer > then the frame keeps its own scroll beside the sidebar", () => {
    expect(scrollsWithPage("web", false)).toBe(false);
  });

  it("given the phone app > then the frame keeps its own scroll", () => {
    expect(scrollsWithPage("ios", true)).toBe(false);
    expect(scrollsWithPage("android", true)).toBe(false);
  });
});

describe("pinnedPosition", () => {
  it("given the website, where the page itself scrolls > then the tab bar and buttons are fixed to the screen", () => {
    expect(pinnedPosition("web")).toBe("fixed");
  });

  it("given the phone app > then they sit on the frame as before", () => {
    expect(pinnedPosition("ios")).toBe("absolute");
  });
});
