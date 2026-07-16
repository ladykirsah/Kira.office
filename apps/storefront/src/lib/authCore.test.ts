import { describe, it, expect } from "vitest";
import {
  generateOtpCode,
  randomSessionToken,
  sha256Hex,
  hashOtp,
  throttleWindowStart,
} from "./authCore";

describe("generateOtpCode", () => {
  it("returns exactly 6 digits, zero-padded", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("randomSessionToken", () => {
  it("returns 64 lowercase hex chars (256 bits) and does not repeat", () => {
    const a = randomSessionToken();
    const b = randomSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("sha256Hex", () => {
  it("matches the known SHA-256 of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("hashOtp", () => {
  it("is deterministic for the same code+salt and differs across salts", async () => {
    const h1 = await hashOtp("123456", "salt-a");
    const h2 = await hashOtp("123456", "salt-a");
    const h3 = await hashOtp("123456", "salt-b");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

describe("throttleWindowStart", () => {
  it("buckets timestamps into fixed windows", () => {
    const win = 600_000; // 10 min
    expect(throttleWindowStart(1_800_000_000_123, win)).toBe(
      1_800_000_000_123 - (1_800_000_000_123 % win),
    );
    // two timestamps in the same window share a bucket
    const t1 = 1_800_000_000_000;
    expect(throttleWindowStart(t1 + 1, win)).toBe(throttleWindowStart(t1 + win - 1, win));
    // the next window is a different bucket
    expect(throttleWindowStart(t1 + win, win)).not.toBe(throttleWindowStart(t1, win));
  });
});
