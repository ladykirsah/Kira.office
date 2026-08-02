import { describe, it, expect } from "vitest";
import {
  creditScoreFromEvents,
  loyaltyCredit,
  tierFromCredit,
  meetsBestEarn,
  meetsBestHold,
  codApproval,
  computeEffectiveTier,
  type CreditEvent,
} from "./customerTier";

/**
 * The owner's credit model (2 Aug 2026). Credit is a DEMERIT counter, not an order tally:
 *   - a completed order is worth 0 on its own (a clean customer sits at 0 = good);
 *   - an incomplete order is −1;
 *   - a mistake is repaid FORWARD — 2 completed orders after it earn +1 back — and never pre-absorbed
 *     by past completes (recovery is earned, not banked);
 *   - the order part is capped at 0; only loyalty can push a customer positive;
 *   - loyalty adds +1 per criterion (earn, hold), so a loyal customer buffers mistakes.
 * Tier is then a pure function of the total credit, so the number always matches the badge.
 */

const complete: CreditEvent = { type: "complete" };
const incomplete: CreditEvent = { type: "incomplete" };
const ret: CreditEvent = { type: "product_return" };

describe("creditScoreFromEvents (order credit, chronological, capped at 0)", () => {
  it("a new customer with no orders is 0", () => {
    expect(creditScoreFromEvents([])).toBe(0);
  });

  it("completed orders alone never push credit above 0 (fixes the old +1-per-order inflation)", () => {
    expect(creditScoreFromEvents([complete, complete, complete])).toBe(0);
    expect(creditScoreFromEvents(Array(38).fill(complete))).toBe(0);
  });

  it("each incomplete is −1", () => {
    expect(creditScoreFromEvents([incomplete])).toBe(-1);
    expect(creditScoreFromEvents([incomplete, incomplete])).toBe(-2);
  });

  it("a mistake is repaid by 2 completed orders after it (+1)", () => {
    expect(creditScoreFromEvents([incomplete, complete])).toBe(-1); // 1 complete is not enough
    expect(creditScoreFromEvents([incomplete, complete, complete])).toBe(0); // 2 completes repay it
  });

  it("2 mistakes need 4 completes to clear", () => {
    expect(creditScoreFromEvents([incomplete, incomplete, complete, complete])).toBe(-1);
    expect(
      creditScoreFromEvents([incomplete, incomplete, complete, complete, complete, complete]),
    ).toBe(0);
  });

  it("past completes do NOT pre-absorb a later mistake — recovery is forward only", () => {
    // Many clean completes then one incomplete: still −1, because those completes happened while at 0.
    expect(creditScoreFromEvents([...Array(10).fill(complete), incomplete])).toBe(-1);
  });

  it("repayment never overshoots 0 — extra completes after clearing are ignored", () => {
    expect(creditScoreFromEvents([incomplete, complete, complete, complete, complete])).toBe(0);
  });

  it("product returns never move credit", () => {
    expect(creditScoreFromEvents([complete, ret, ret, incomplete, ret])).toBe(-1);
  });
});

describe("loyaltyCredit (+1 per criterion met, max +2)", () => {
  const meets = { completedOrdersInWindow: 12, totalSpentSatangInWindow: 20_000_00 };
  const misses = { completedOrdersInWindow: 0, totalSpentSatangInWindow: 0 };

  it("neither criterion > 0", () => {
    expect(loyaltyCredit(misses, misses)).toBe(0);
    expect(loyaltyCredit(null, null)).toBe(0);
  });

  it("earn only > +1", () => {
    expect(loyaltyCredit(meets, misses)).toBe(1);
  });

  it("hold only > +1", () => {
    expect(loyaltyCredit(misses, meets)).toBe(1);
  });

  it("both criteria > +2", () => {
    expect(loyaltyCredit(meets, meets)).toBe(2);
  });
});

describe("tierFromCredit (the bands the owner set)", () => {
  it("≥ 1 (loyalty above mistakes) > best", () => {
    expect(tierFromCredit(1)).toBe("best");
    expect(tierFromCredit(2)).toBe("best");
  });
  it("exactly 0 > good", () => {
    expect(tierFromCredit(0)).toBe("good");
  });
  it("−1 and −2 > watch", () => {
    expect(tierFromCredit(-1)).toBe("watch");
    expect(tierFromCredit(-2)).toBe("watch");
  });
  it("−3 to −5 > bad", () => {
    expect(tierFromCredit(-3)).toBe("bad");
    expect(tierFromCredit(-5)).toBe("bad");
  });
  it("−6 or worse > block", () => {
    expect(tierFromCredit(-6)).toBe("block");
    expect(tierFromCredit(-10)).toBe("block");
  });
});

describe("meetsBestEarn / meetsBestHold (unchanged loyalty criteria)", () => {
  it("earn: 10 orders OR ฿15,000 in the window", () => {
    expect(meetsBestEarn({ completedOrdersInWindow: 10, totalSpentSatangInWindow: 0 })).toBe(true);
    expect(meetsBestEarn({ completedOrdersInWindow: 0, totalSpentSatangInWindow: 15_000_00 })).toBe(
      true,
    );
    expect(meetsBestEarn({ completedOrdersInWindow: 9, totalSpentSatangInWindow: 14_999_00 })).toBe(
      false,
    );
  });
  it("hold: 3 orders OR ฿5,000 in the window", () => {
    expect(meetsBestHold({ completedOrdersInWindow: 3, totalSpentSatangInWindow: 0 })).toBe(true);
    expect(meetsBestHold({ completedOrdersInWindow: 0, totalSpentSatangInWindow: 5_000_00 })).toBe(
      true,
    );
    expect(meetsBestHold({ completedOrdersInWindow: 2, totalSpentSatangInWindow: 4_999_00 })).toBe(
      false,
    );
  });
});

describe("codApproval", () => {
  it("best / good auto-approve; watch needs staff; bad + block are blocked", () => {
    expect(codApproval("best")).toBe("auto");
    expect(codApproval("good")).toBe("auto");
    expect(codApproval("watch")).toBe("staff");
    expect(codApproval("bad")).toBe("blocked");
    expect(codApproval("block")).toBe("blocked");
  });
});

describe("computeEffectiveTier (tier is a pure function of credit + admin block)", () => {
  it("a new customer (0) is good", () => {
    expect(computeEffectiveTier({ credit: 0, adminBlocked: false })).toBe("good");
  });
  it("a loyal customer above 0 is best", () => {
    expect(computeEffectiveTier({ credit: 2, adminBlocked: false })).toBe("best");
  });
  it("a loyal +2 customer after one mistake (+1) is still best", () => {
    expect(computeEffectiveTier({ credit: 1, adminBlocked: false })).toBe("best");
  });
  it("one mistake with no loyalty (−1) is watch", () => {
    expect(computeEffectiveTier({ credit: -1, adminBlocked: false })).toBe("watch");
  });
  it("−6 is block on credit alone", () => {
    expect(computeEffectiveTier({ credit: -6, adminBlocked: false })).toBe("block");
  });
  it("admin block overrides any credit", () => {
    expect(computeEffectiveTier({ credit: 2, adminBlocked: true })).toBe("block");
  });
});
