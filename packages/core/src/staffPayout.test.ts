import { describe, expect, it } from "vitest";
import { isPayMethod, slipRequired, payoutProblem, settleMonth } from "./staffPayout";

/**
 * How money leaves the shop for a person — an advance before payday, or the wage itself.
 *
 * The owner's rule, 2026-08-24, and it is the SAME rule for both: paying cash needs nothing beyond
 * the amount, paying by transfer requires the slip. Before this, marking a wage paid demanded a slip
 * unconditionally, which is wrong for a shop that mostly hands over cash — it pushed people into
 * either not recording the payment or attaching something meaningless.
 */
describe("isPayMethod", () => {
  it("given the two real methods > then yes", () => {
    expect(isPayMethod("cash")).toBe(true);
    expect(isPayMethod("transfer")).toBe(true);
  });

  it("given anything else > then no", () => {
    for (const v of ["CASH", "Transfer", "bank", "", null, undefined, 1, {}]) {
      expect(isPayMethod(v), JSON.stringify(v) ?? "undefined").toBe(false);
    }
  });
});

describe("slipRequired", () => {
  it("given a transfer > then a slip is required", () => {
    expect(slipRequired("transfer")).toBe(true);
  });

  it("given cash > then no slip is needed", () => {
    expect(slipRequired("cash")).toBe(false);
  });
});

describe("payoutProblem", () => {
  it("given cash with no slip > then no problem", () => {
    expect(payoutProblem({ method: "cash", slipKey: null })).toBeNull();
  });

  it("given a transfer with a slip > then no problem", () => {
    expect(payoutProblem({ method: "transfer", slipKey: "slips/abc.jpg" })).toBeNull();
  });

  it("given a transfer with NO slip > then it says so, in the owner's words", () => {
    expect(payoutProblem({ method: "transfer", slipKey: null })).toBe(
      "a transfer needs its slip attached",
    );
  });

  it("given a transfer with a blank slip key > then still refused", () => {
    // An empty string is not a slip; without this a whitespace field would pass as proof.
    expect(payoutProblem({ method: "transfer", slipKey: "   " })).toBe(
      "a transfer needs its slip attached",
    );
  });

  it("given an unknown method > then refused rather than guessed", () => {
    expect(payoutProblem({ method: "bank", slipKey: null })).toBe(
      "method must be cash or transfer",
    );
    expect(payoutProblem({ method: undefined, slipKey: null })).toBe(
      "method must be cash or transfer",
    );
  });

  it("given cash WITH a slip > then allowed — a photo of a cash handover is not an error", () => {
    expect(payoutProblem({ method: "cash", slipKey: "slips/abc.jpg" })).toBeNull();
  });
});

/**
 * What is still owed on payday once advances are taken off.
 *
 * The owner's rule for over-advancing (2026-08-24): it is ALLOWED, the month simply pays ฿0, and
 * the excess is reported as owed so it can be settled by hand. Deliberately no automatic carry into
 * next month — a debt that follows someone across months silently is how a wage quietly becomes a
 * number nobody can explain.
 */
describe("settleMonth", () => {
  it("given no advances > then the whole wage is due", () => {
    expect(settleMonth({ earnedSatang: 1475000, advanceSatang: 0 })).toEqual({
      dueSatang: 1475000,
      owedSatang: 0,
    });
  });

  it("given an advance under the wage > then the difference is due", () => {
    expect(settleMonth({ earnedSatang: 1475000, advanceSatang: 300000 })).toEqual({
      dueSatang: 1175000,
      owedSatang: 0,
    });
  });

  it("given advances exactly equal to the wage > then nothing due and nothing owed", () => {
    expect(settleMonth({ earnedSatang: 1475000, advanceSatang: 1475000 })).toEqual({
      dueSatang: 0,
      owedSatang: 0,
    });
  });

  it("given more advance than the wage > then ฿0 due and the excess owed", () => {
    expect(settleMonth({ earnedSatang: 1475000, advanceSatang: 2000000 })).toEqual({
      dueSatang: 0,
      owedSatang: 525000,
    });
  });

  it("given a month with no working days > then the whole advance is owed", () => {
    expect(settleMonth({ earnedSatang: 0, advanceSatang: 300000 })).toEqual({
      dueSatang: 0,
      owedSatang: 300000,
    });
  });

  it("never returns a negative on either side", () => {
    const r = settleMonth({ earnedSatang: 0, advanceSatang: 0 });
    expect(r.dueSatang).toBe(0);
    expect(r.owedSatang).toBe(0);
  });
});
