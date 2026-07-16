import { describe, it, expect } from "vitest";
import {
  DISPLAY_NAME_MAX,
  displayNameError,
  normalizeDisplayName,
  phoneChangeError,
} from "./accountProfile";

describe("normalizeDisplayName", () => {
  it("given padding and doubled spaces > trimmed and collapsed", () => {
    expect(normalizeDisplayName("  สมชาย   ใจดี  ")).toBe("สมชาย ใจดี");
  });

  it("given whitespace only > empty string (the 'not captured' sentinel)", () => {
    expect(normalizeDisplayName("   ")).toBe("");
  });
});

describe("displayNameError", () => {
  it("given a real name > no error", () => {
    expect(displayNameError("สมชาย ใจดี")).toBeNull();
  });

  it("given a single character > rejected", () => {
    // This is literally the bug the owner found: "L" was accepted as a name and frozen forever.
    expect(displayNameError("L")).toBeTruthy();
  });

  it("given empty or whitespace > rejected", () => {
    expect(displayNameError("")).toBeTruthy();
    expect(displayNameError("   ")).toBeTruthy();
  });

  it("given something longer than the limit > rejected", () => {
    expect(displayNameError("ก".repeat(DISPLAY_NAME_MAX + 1))).toBeTruthy();
  });

  it("given exactly the limit > accepted (boundary is inclusive)", () => {
    expect(displayNameError("ก".repeat(DISPLAY_NAME_MAX))).toBeNull();
  });

  it("validates the NORMALIZED value, so padding cannot smuggle a too-short name past", () => {
    expect(displayNameError("  L  ")).toBeTruthy();
  });
});

describe("phoneChangeError", () => {
  const ok = { currentPhone: "0812345678", nextPhone: "0899999999", taken: false };

  it("given a free, valid, different number > no error", () => {
    expect(phoneChangeError(ok)).toBeNull();
  });

  it("given the number already on the account > rejected (nothing to do)", () => {
    expect(phoneChangeError({ ...ok, nextPhone: "0812345678" })).toBeTruthy();
  });

  it("given a number belonging to another account > rejected", () => {
    // Without this, one customer could seize another's phone — and with it every order that the
    // guest lookup resolves by (ref, phone).
    expect(phoneChangeError({ ...ok, taken: true })).toBeTruthy();
  });

  it("given a malformed number > rejected", () => {
    expect(phoneChangeError({ ...ok, nextPhone: "123" })).toBeTruthy();
    expect(phoneChangeError({ ...ok, nextPhone: "" })).toBeTruthy();
    expect(phoneChangeError({ ...ok, nextPhone: "08123456789012" })).toBeTruthy();
  });

  it("checks 'taken' even when the format is fine — order of checks cannot skip the takeover guard", () => {
    expect(phoneChangeError({ currentPhone: "0812345678", nextPhone: "0899999999", taken: true }))
      .toBeTruthy();
  });
});
