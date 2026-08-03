import { describe, it, expect } from "vitest";
import { validateExpenseInput, isExpenseChannel } from "./expense";

describe("isExpenseChannel", () => {
  it("accepts the two finance channels, rejects anything else", () => {
    expect(isExpenseChannel("onsite")).toBe(true);
    expect(isExpenseChannel("airplus")).toBe(true);
    expect(isExpenseChannel("shopee")).toBe(false);
    expect(isExpenseChannel("")).toBe(false);
    expect(isExpenseChannel(null)).toBe(false);
  });
});

describe("validateExpenseInput", () => {
  const ok = {
    channel: "airplus",
    conversion: "AI package",
    amountSatang: 120000,
    occurredAt: 1000,
  };

  it("given a valid input > returns null", () => {
    expect(validateExpenseInput(ok)).toBeNull();
  });

  it("given a missing body > is rejected", () => {
    expect(validateExpenseInput(null)).toMatch(/required/);
  });

  it("given a channel that isn't onsite/airplus > is rejected", () => {
    expect(validateExpenseInput({ ...ok, channel: "shopee" })).toMatch(/channel/);
  });

  it("given an empty conversion label > is rejected", () => {
    expect(validateExpenseInput({ ...ok, conversion: "  " })).toMatch(/conversion/);
  });

  it("given a non-positive or non-integer amount > is rejected", () => {
    expect(validateExpenseInput({ ...ok, amountSatang: 0 })).toMatch(/amount/);
    expect(validateExpenseInput({ ...ok, amountSatang: -5 })).toMatch(/amount/);
    expect(validateExpenseInput({ ...ok, amountSatang: 12.5 })).toMatch(/amount/);
  });

  it("given a missing date > is rejected", () => {
    expect(validateExpenseInput({ ...ok, occurredAt: undefined })).toMatch(/occurredAt/);
  });
});
