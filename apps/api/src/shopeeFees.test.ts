import { describe, expect, it } from "vitest";
import { checkShopeeFees, NO_FEES, readShopeeFees } from "./shopeeFees";

// ค่าคอม Shopee (owner, 5 Nov 2026: "i want A, but on the main page is total %, and the pop up shown all
// amount we have been charged"): one set of Shopee fees for the whole business, in hundredths of a percent.

describe("readShopeeFees", () => {
  it("given nothing saved yet > then every fee is 0", () => {
    expect(readShopeeFees(null)).toEqual(NO_FEES);
  });

  it("given saved fees > then they read back as saved", () => {
    const raw = JSON.stringify({ commissionBp: 1200, transactionBp: 321, serviceBp: 200 });
    expect(readShopeeFees(raw)).toEqual({ commissionBp: 1200, transactionBp: 321, serviceBp: 200 });
  });

  it("given a broken value > then 0s, never a crash", () => {
    expect(readShopeeFees("{not json")).toEqual(NO_FEES);
    expect(readShopeeFees(JSON.stringify({ commissionBp: "12" }))).toEqual(NO_FEES);
  });
});

describe("checkShopeeFees", () => {
  it("given three whole hundredths of a percent > then they are the fees", () => {
    expect(checkShopeeFees({ commissionBp: 1200, transactionBp: 321, serviceBp: 0 })).toEqual({
      commissionBp: 1200,
      transactionBp: 321,
      serviceBp: 0,
    });
  });

  it("given a fee left out > then it is refused, not taken as 0", () => {
    expect(typeof checkShopeeFees({ commissionBp: 1200, transactionBp: 300 })).toBe("string");
  });

  it("given a negative, a fraction of a hundredth, or a word > then it is refused", () => {
    expect(typeof checkShopeeFees({ commissionBp: -1, transactionBp: 0, serviceBp: 0 })).toBe(
      "string",
    );
    expect(typeof checkShopeeFees({ commissionBp: 12.5, transactionBp: 0, serviceBp: 0 })).toBe(
      "string",
    );
    expect(typeof checkShopeeFees({ commissionBp: "1200", transactionBp: 0, serviceBp: 0 })).toBe(
      "string",
    );
    expect(typeof checkShopeeFees(null)).toBe("string");
  });

  it("given fees that add up to more than 100% > then it is refused", () => {
    expect(typeof checkShopeeFees({ commissionBp: 6000, transactionBp: 4001, serviceBp: 0 })).toBe(
      "string",
    );
    expect(checkShopeeFees({ commissionBp: 6000, transactionBp: 4000, serviceBp: 0 })).toEqual({
      commissionBp: 6000,
      transactionBp: 4000,
      serviceBp: 0,
    });
  });
});
