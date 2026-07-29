import { describe, it, expect } from "vitest";
import { interestBadge, INTEREST_MIN } from "./affiliateInterest";

describe("interestBadge", () => {
  it("given enough clicks > reads as social proof in Thai", () => {
    expect(interestBadge(128)).toBe("คนกดดูแล้ว 128 ครั้ง");
  });

  it("given a brand-new card > shows nothing rather than a weak number", () => {
    expect(interestBadge(0)).toBeNull();
    expect(interestBadge(INTEREST_MIN - 1)).toBeNull();
  });

  it("given exactly the threshold > starts showing", () => {
    expect(interestBadge(INTEREST_MIN)).toBe(`คนกดดูแล้ว ${INTEREST_MIN} ครั้ง`);
  });

  it("given thousands > groups the digits so the number stays readable", () => {
    expect(interestBadge(1234)).toBe("คนกดดูแล้ว 1,234 ครั้ง");
  });

  it("given a missing count > shows nothing (an old row, not a zero claim)", () => {
    expect(interestBadge(undefined)).toBeNull();
  });
});
