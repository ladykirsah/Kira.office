import { describe, expect, it } from "vitest";
import { deleteRefusal, duplicateCodeRefusal } from "./couponRefusal";

/**
 * TWO REFUSALS THE SERVER ALREADY MAKES, SAID HERE INSTEAD (2026-08-26).
 *
 * The API answers both of these with a 409 whose message is written in English, because it has no
 * idea who is reading. Both answers are already knowable from what is on the screen — the redemption
 * count, and the list of codes — so they are decided here and spoken in the reader's language.
 *
 * The 409 stays as the backstop: another till can add a code, or redeem a coupon, between the check
 * and the request. This is the polite refusal, not the lock.
 */
describe("deleteRefusal", () => {
  /** A redeemed coupon is financial history. The owner's rule: disable it, never delete it. */
  it("given a coupon somebody used > then refuses, and says what to do instead", () => {
    const said = deleteRefusal(3);
    expect(said).not.toBeNull();
    expect(said!.th).toContain("3");
    expect(said!.th).toContain("ปิดใช้งาน");
    expect(said!.en).toContain("3 redemption(s)");
  });

  it("given a coupon nobody has used > then no objection", () => {
    expect(deleteRefusal(0)).toBeNull();
  });

  /**
   * A negative count cannot happen, and if it ever did it would mean the count is broken — which is
   * the worst possible moment to wave a delete through.
   */
  it("given a count that makes no sense > then still refuses, rather than trusting it", () => {
    expect(deleteRefusal(-1)).not.toBeNull();
  });
});

describe("duplicateCodeRefusal", () => {
  it("given a code already on the list > then names it and refuses", () => {
    const said = duplicateCodeRefusal("WELCOME10", ["SUMMER5", "WELCOME10"]);
    expect(said).not.toBeNull();
    expect(said!.th).toContain("WELCOME10");
    expect(said!.en).toContain("WELCOME10");
  });

  it("given a code nobody is using > then no objection", () => {
    expect(duplicateCodeRefusal("WELCOME10", ["SUMMER5"])).toBeNull();
    expect(duplicateCodeRefusal("WELCOME10", [])).toBeNull();
  });

  /**
   * Codes are stored upper-case and the box upper-cases as you type, but a code arriving from
   * anywhere else must not slip past by being the same word in another case.
   */
  it("given the same code in another case > then still a clash", () => {
    expect(duplicateCodeRefusal("welcome10", ["WELCOME10"])).not.toBeNull();
    expect(duplicateCodeRefusal(" WELCOME10 ", ["WELCOME10"])).not.toBeNull();
  });
});
