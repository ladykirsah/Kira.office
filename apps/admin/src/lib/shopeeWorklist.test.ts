import { describe, it, expect } from "vitest";
import { shopeeWorklistErrorText } from "./shopeeWorklist";

describe("shopeeWorklistErrorText", () => {
  it("given a real failure > shows the actual reason, status and all", () => {
    expect(shopeeWorklistErrorText(new Error("Failed to load Shopee worklist (HTTP 404)"))).toBe(
      "Failed to load Shopee worklist (HTTP 404)",
    );
  });

  it("given a bare network failure > names what couldn't be reached, keeping the reason", () => {
    // What a dead API host actually throws. On its own "fetch failed" tells the owner nothing.
    expect(shopeeWorklistErrorText(new Error("fetch failed"))).toBe(
      "Couldn't reach the stock API (fetch failed)",
    );
    expect(shopeeWorklistErrorText(new TypeError("Failed to fetch"))).toBe(
      "Couldn't reach the stock API (Failed to fetch)",
    );
  });

  it("given an error with no message > falls back rather than printing nothing", () => {
    expect(shopeeWorklistErrorText(new Error(""))).toBe("Something went wrong.");
  });

  it("given something that isn't an Error > falls back", () => {
    expect(shopeeWorklistErrorText("boom")).toBe("Something went wrong.");
    expect(shopeeWorklistErrorText(undefined)).toBe("Something went wrong.");
  });
});
