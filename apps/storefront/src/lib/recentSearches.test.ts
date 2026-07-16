import { describe, it, expect } from "vitest";
import { nextRecentSearches } from "./recentSearches";

describe("nextRecentSearches", () => {
  it("given a new term > prepends it (most-recent first)", () => {
    expect(nextRecentSearches(["คอมเพรสเซอร์ D-Max"], "ตู้แอร์ Vigo")).toEqual([
      "ตู้แอร์ Vigo",
      "คอมเพรสเซอร์ D-Max",
    ]);
  });

  it("given surrounding whitespace > stores the trimmed term", () => {
    expect(nextRecentSearches([], "  ตู้แอร์ Vigo  ")).toEqual(["ตู้แอร์ Vigo"]);
  });

  it("given a blank/whitespace-only term > leaves the list unchanged (capped)", () => {
    expect(nextRecentSearches(["a", "b"], "   ")).toEqual(["a", "b"]);
    expect(nextRecentSearches(["a", "b"], "")).toEqual(["a", "b"]);
  });

  it("given a term already present (any case) > moves it to the front with the new casing, no duplicate", () => {
    expect(nextRecentSearches(["vigo", "denso"], "VIGO")).toEqual(["VIGO", "denso"]);
  });

  it("given more than the cap > keeps only the most-recent `cap` terms", () => {
    const list = ["1", "2", "3"];
    expect(nextRecentSearches(list, "0", 3)).toEqual(["0", "1", "2"]);
  });

  it("defaults the cap to 8", () => {
    const nine = ["8", "7", "6", "5", "4", "3", "2", "1"]; // already 8
    expect(nextRecentSearches(nine, "9")).toEqual(["9", "8", "7", "6", "5", "4", "3", "2"]);
  });
});
