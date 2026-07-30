import { describe, it, expect } from "vitest";
import {
  creditScoreFromEvents,
  tierFromCredit,
  isVelocityBlock,
  meetsBestEarn,
  meetsBestHold,
  codApproval,
  isBadRecovered,
  computeEffectiveTier,
  type CreditEvent,
  type CustomerTier,
} from "./customerTier";

describe("creditScoreFromEvents", () => {
  it("given no events > returns 0 (new customer)", () => {
    expect(creditScoreFromEvents([])).toBe(0);
  });

  it("given only complete orders > returns positive credit", () => {
    const events: CreditEvent[] = [
      { type: "complete" },
      { type: "complete" },
      { type: "complete" },
    ];
    expect(creditScoreFromEvents(events)).toBe(3);
  });

  it("given only incomplete orders > returns negative credit", () => {
    const events: CreditEvent[] = [{ type: "incomplete" }, { type: "incomplete" }];
    expect(creditScoreFromEvents(events)).toBe(-2);
  });

  it("given mixed complete and incomplete > returns net credit", () => {
    const events: CreditEvent[] = [
      { type: "complete" },
      { type: "complete" },
      { type: "incomplete" },
      { type: "complete" },
      { type: "incomplete" },
      { type: "incomplete" },
    ];
    expect(creditScoreFromEvents(events)).toBe(0);
  });

  it("given product-failure returns > does NOT count them as negative", () => {
    const events: CreditEvent[] = [
      { type: "complete" },
      { type: "complete" },
      { type: "product_return" },
      { type: "product_return" },
      { type: "product_return" },
    ];
    expect(creditScoreFromEvents(events)).toBe(2);
  });

  it("given product returns mixed with incompletes > only incompletes reduce credit", () => {
    const events: CreditEvent[] = [
      { type: "complete" },
      { type: "incomplete" },
      { type: "product_return" },
      { type: "incomplete" },
      { type: "product_return" },
    ];
    expect(creditScoreFromEvents(events)).toBe(-1);
  });
});

describe("tierFromCredit", () => {
  it("given credit 0 (new customer) > good", () => {
    expect(tierFromCredit(0)).toBe("good");
  });

  it("given positive credit > good", () => {
    expect(tierFromCredit(5)).toBe("good");
    expect(tierFromCredit(100)).toBe("good");
  });

  it("given credit -1 > good (1 mistake allowed)", () => {
    expect(tierFromCredit(-1)).toBe("good");
  });

  it("given credit -2 > good (2 mistakes allowed)", () => {
    expect(tierFromCredit(-2)).toBe("good");
  });

  it("given credit -3 > watch", () => {
    expect(tierFromCredit(-3)).toBe("watch");
  });

  it("given credit -4 > watch", () => {
    expect(tierFromCredit(-4)).toBe("watch");
  });

  it("given credit -5 > bad", () => {
    expect(tierFromCredit(-5)).toBe("bad");
  });

  it("given credit -10 > bad", () => {
    expect(tierFromCredit(-10)).toBe("bad");
  });
});

describe("isVelocityBlock", () => {
  it("given 4 incompletes in a month > not blocked", () => {
    expect(isVelocityBlock(4)).toBe(false);
  });

  it("given 5 incompletes in a month > blocked", () => {
    expect(isVelocityBlock(5)).toBe(true);
  });

  it("given 10 incompletes in a month > blocked", () => {
    expect(isVelocityBlock(10)).toBe(true);
  });

  it("given 0 incompletes > not blocked", () => {
    expect(isVelocityBlock(0)).toBe(false);
  });
});

describe("meetsBestEarn", () => {
  it("given 10+ orders in 90 days > earns best", () => {
    expect(meetsBestEarn({ completedOrdersInWindow: 10, totalSpentSatangInWindow: 0 })).toBe(true);
  });

  it("given 15,000+ baht spent in 90 days > earns best", () => {
    expect(
      meetsBestEarn({
        completedOrdersInWindow: 1,
        totalSpentSatangInWindow: 15_000_00,
      }),
    ).toBe(true);
  });

  it("given 9 orders and 14,999 baht > does not earn best", () => {
    expect(
      meetsBestEarn({
        completedOrdersInWindow: 9,
        totalSpentSatangInWindow: 14_999_00,
      }),
    ).toBe(false);
  });

  it("given exactly the threshold > earns (inclusive)", () => {
    expect(
      meetsBestEarn({
        completedOrdersInWindow: 10,
        totalSpentSatangInWindow: 0,
      }),
    ).toBe(true);
    expect(
      meetsBestEarn({
        completedOrdersInWindow: 0,
        totalSpentSatangInWindow: 15_000_00,
      }),
    ).toBe(true);
  });
});

describe("meetsBestHold", () => {
  it("given 3+ orders in 60 days > holds best", () => {
    expect(meetsBestHold({ completedOrdersInWindow: 3, totalSpentSatangInWindow: 0 })).toBe(true);
  });

  it("given 5,000+ baht in 60 days > holds best", () => {
    expect(
      meetsBestHold({
        completedOrdersInWindow: 0,
        totalSpentSatangInWindow: 5_000_00,
      }),
    ).toBe(true);
  });

  it("given 2 orders and 4,999 baht > does not hold best", () => {
    expect(
      meetsBestHold({
        completedOrdersInWindow: 2,
        totalSpentSatangInWindow: 4_999_00,
      }),
    ).toBe(false);
  });
});

describe("codApproval", () => {
  it("best > auto-approved", () => {
    expect(codApproval("best")).toBe("auto");
  });

  it("good > auto-approved", () => {
    expect(codApproval("good")).toBe("auto");
  });

  it("watch > needs staff approval", () => {
    expect(codApproval("watch")).toBe("staff");
  });

  it("bad > blocked", () => {
    expect(codApproval("bad")).toBe("blocked");
  });

  it("block > blocked", () => {
    expect(codApproval("block")).toBe("blocked");
  });
});

describe("isBadRecovered", () => {
  const DAY = 86_400_000;
  const lockStart = 1_700_000_000_000;
  const lockEnd = lockStart + 90 * DAY;

  it("given lock not expired > not recovered regardless of completions", () => {
    expect(
      isBadRecovered({
        badLockedUntil: lockEnd,
        prepaidCompletionsSinceLock: 5,
        now: lockEnd - 1,
      }),
    ).toBe(false);
  });

  it("given lock expired but 0 prepaid completions > not recovered", () => {
    expect(
      isBadRecovered({
        badLockedUntil: lockEnd,
        prepaidCompletionsSinceLock: 0,
        now: lockEnd + 1,
      }),
    ).toBe(false);
  });

  it("given lock expired and 1 prepaid completion > not recovered (need 2)", () => {
    expect(
      isBadRecovered({
        badLockedUntil: lockEnd,
        prepaidCompletionsSinceLock: 1,
        now: lockEnd + 1,
      }),
    ).toBe(false);
  });

  it("given lock expired and 2+ prepaid completions > recovered", () => {
    expect(
      isBadRecovered({
        badLockedUntil: lockEnd,
        prepaidCompletionsSinceLock: 2,
        now: lockEnd + 1,
      }),
    ).toBe(true);
  });
});

describe("computeEffectiveTier", () => {
  it("given new customer (credit 0, no loyalty) > good", () => {
    expect(
      computeEffectiveTier({
        credit: 0,
        earn: null,
        hold: null,
        incompletesThisMonth: 0,
        adminBlocked: false,
      }),
    ).toBe("good");
  });

  it("given loyal customer with good credit > best", () => {
    expect(
      computeEffectiveTier({
        credit: 5,
        earn: { completedOrdersInWindow: 12, totalSpentSatangInWindow: 20_000_00 },
        hold: { completedOrdersInWindow: 4, totalSpentSatangInWindow: 6_000_00 },
        incompletesThisMonth: 0,
        adminBlocked: false,
      }),
    ).toBe("best");
  });

  it("given loyal customer who earned but no longer holds > good (lost best)", () => {
    expect(
      computeEffectiveTier({
        credit: 5,
        earn: { completedOrdersInWindow: 12, totalSpentSatangInWindow: 20_000_00 },
        hold: { completedOrdersInWindow: 1, totalSpentSatangInWindow: 2_000_00 },
        incompletesThisMonth: 0,
        adminBlocked: false,
      }),
    ).toBe("good");
  });

  it("given best earner with credit at -3 > watch (incidents override loyalty)", () => {
    expect(
      computeEffectiveTier({
        credit: -3,
        earn: { completedOrdersInWindow: 15, totalSpentSatangInWindow: 30_000_00 },
        hold: { completedOrdersInWindow: 5, totalSpentSatangInWindow: 8_000_00 },
        incompletesThisMonth: 0,
        adminBlocked: false,
      }),
    ).toBe("watch");
  });

  it("given credit -5 > bad (regardless of loyalty)", () => {
    expect(
      computeEffectiveTier({
        credit: -5,
        earn: { completedOrdersInWindow: 15, totalSpentSatangInWindow: 30_000_00 },
        hold: { completedOrdersInWindow: 5, totalSpentSatangInWindow: 8_000_00 },
        incompletesThisMonth: 0,
        adminBlocked: false,
      }),
    ).toBe("bad");
  });

  it("given 5+ incompletes this month > block (velocity)", () => {
    expect(
      computeEffectiveTier({
        credit: 0,
        earn: null,
        hold: null,
        incompletesThisMonth: 5,
        adminBlocked: false,
      }),
    ).toBe("block");
  });

  it("given admin-blocked > block (overrides everything)", () => {
    expect(
      computeEffectiveTier({
        credit: 10,
        earn: { completedOrdersInWindow: 20, totalSpentSatangInWindow: 50_000_00 },
        hold: { completedOrdersInWindow: 10, totalSpentSatangInWindow: 20_000_00 },
        incompletesThisMonth: 0,
        adminBlocked: true,
      }),
    ).toBe("block");
  });

  it("given bad customer with recovery > good", () => {
    const DAY = 86_400_000;
    const lockStart = 1_700_000_000_000;
    const lockEnd = lockStart + 90 * DAY;
    expect(
      computeEffectiveTier({
        credit: -5,
        earn: null,
        hold: null,
        incompletesThisMonth: 0,
        adminBlocked: false,
        badRecovery: {
          badLockedUntil: lockEnd,
          prepaidCompletionsSinceLock: 2,
          now: lockEnd + DAY,
        },
      }),
    ).toBe("good");
  });

  it("given bad customer with incomplete recovery > bad", () => {
    const DAY = 86_400_000;
    const lockStart = 1_700_000_000_000;
    const lockEnd = lockStart + 90 * DAY;
    expect(
      computeEffectiveTier({
        credit: -5,
        earn: null,
        hold: null,
        incompletesThisMonth: 0,
        adminBlocked: false,
        badRecovery: {
          badLockedUntil: lockEnd,
          prepaidCompletionsSinceLock: 1,
          now: lockEnd + DAY,
        },
      }),
    ).toBe("bad");
  });
});
