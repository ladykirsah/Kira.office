import { describe, expect, it } from "vitest";
import { payQr } from "./qr";

describe("payQr", () => {
  it("given a PromptPay phone number and an amount > then a square QR with its three corner squares", () => {
    const grid = payQr("0812345678", 426000);
    expect(grid).not.toBeNull();
    const n = grid!.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(grid!.every((row) => row.length === n)).toBe(true);
    // The finder squares: dark at the top-left, top-right and bottom-left corners.
    expect(grid![0]![0]).toBe(true);
    expect(grid![0]![n - 1]).toBe(true);
    expect(grid![n - 1]![0]).toBe(true);
  });

  it("given a PromptPay ID that is not one > then no QR, rather than one that pays nobody", () => {
    expect(payQr("12345", 426000)).toBeNull();
  });
});
