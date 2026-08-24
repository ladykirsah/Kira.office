import { describe, it, expect } from "vitest";
import { channelActionLabel } from "./channelActions";

/**
 * The four words in the products-table row menu, set by the owner on 2026-08-24.
 *
 * Locked in a test because they are a decision, not a detail. Two earlier attempts drifted — "Put
 * back on AirPlus" and "Mark listed on Shopee" — and each rewording made the menu read differently
 * from the tabs and the Status column, which use the same vocabulary: a product is either live on a
 * channel or paused on it.
 *
 * The label names the state you are moving TO, not the one you are in. A row showing "Pause on
 * AirPlus" is live right now; clicking it pauses it.
 *
 * Worth knowing and deliberately not encoded in the wording: the Shopee pair is bookkeeping only —
 * there is no Shopee connection, and the flag drives the dashboard's manual worklist. The owner
 * chose the symmetric wording anyway, after being told. See `back-office/products` in the knowledge
 * bundle before "fixing" it.
 */
describe("channelActionLabel", () => {
  it("given a product live on AirPlus > offers to pause it", () => {
    expect(channelActionLabel("AirPlus", true)).toBe("Pause on AirPlus");
  });

  it("given a product paused on AirPlus > offers to make it live", () => {
    expect(channelActionLabel("AirPlus", false)).toBe("Live on AirPlus");
  });

  it("given a product live on Shopee > offers to pause it", () => {
    expect(channelActionLabel("Shopee", true)).toBe("Pause on Shopee");
  });

  it("given a product paused on Shopee > offers to make it live", () => {
    expect(channelActionLabel("Shopee", false)).toBe("Live on Shopee");
  });

  it("the four labels are exactly these, in the owner's words", () => {
    // One assertion that fails loudly if any of them is reworded.
    expect([
      channelActionLabel("AirPlus", true),
      channelActionLabel("AirPlus", false),
      channelActionLabel("Shopee", true),
      channelActionLabel("Shopee", false),
    ]).toEqual(["Pause on AirPlus", "Live on AirPlus", "Pause on Shopee", "Live on Shopee"]);
  });
});
