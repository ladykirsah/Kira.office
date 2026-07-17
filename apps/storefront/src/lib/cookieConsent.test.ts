import { describe, it, expect } from "vitest";
import {
  acceptAll,
  rejectAll,
  makeConsent,
  selectionOf,
  isValidConsent,
  parseConsent,
  needsConsent,
  hasConsent,
  CONSENT_VERSION,
} from "./cookieConsent";

describe("acceptAll / rejectAll", () => {
  it("acceptAll > every optional category on, necessary locked true, timestamp + version stamped", () => {
    expect(acceptAll(1000)).toEqual({
      necessary: true,
      analytics: true,
      marketing: true,
      thirdParty: true,
      at: 1000,
      version: CONSENT_VERSION,
    });
  });

  it("rejectAll > every optional category off, but necessary stays true", () => {
    const c = rejectAll(1000);
    expect(c.necessary).toBe(true);
    expect([c.analytics, c.marketing, c.thirdParty]).toEqual([false, false, false]);
  });
});

describe("makeConsent + selectionOf round-trip", () => {
  it("keeps the exact per-category selection", () => {
    const sel = { analytics: true, marketing: false, thirdParty: true };
    const c = makeConsent(sel, 42);
    expect(selectionOf(c)).toEqual(sel);
  });

  it("selectionOf(null) > all optional categories default to off (opt-in)", () => {
    expect(selectionOf(null)).toEqual({ analytics: false, marketing: false, thirdParty: false });
  });
});

describe("isValidConsent", () => {
  it("accepts a well-formed current-version consent", () => {
    expect(isValidConsent(acceptAll(1))).toBe(true);
  });

  it("rejects a consent from an older version (forces re-consent)", () => {
    expect(isValidConsent({ ...acceptAll(1), version: CONSENT_VERSION - 1 })).toBe(false);
  });

  it("rejects necessary=false, missing fields, and non-objects", () => {
    expect(isValidConsent({ ...acceptAll(1), necessary: false })).toBe(false);
    expect(isValidConsent({ necessary: true, analytics: true })).toBe(false);
    expect(isValidConsent(null)).toBe(false);
    expect(isValidConsent("nope")).toBe(false);
  });
});

describe("parseConsent", () => {
  it("parses a valid stored JSON consent", () => {
    expect(parseConsent(JSON.stringify(acceptAll(7)))?.analytics).toBe(true);
  });

  it("returns null for null, malformed JSON, and stale-version consent", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("{not json")).toBeNull();
    expect(parseConsent(JSON.stringify({ ...acceptAll(1), version: 0 }))).toBeNull();
  });
});

describe("needsConsent", () => {
  it("true when nothing stored, false once a choice exists", () => {
    expect(needsConsent(null)).toBe(true);
    expect(needsConsent(rejectAll(1))).toBe(false);
  });
});

describe("hasConsent (gate for future trackers)", () => {
  it("allows a category only when the stored consent opted it in", () => {
    const c = makeConsent({ analytics: true, marketing: false, thirdParty: false }, 1);
    expect(hasConsent(c, "analytics")).toBe(true);
    expect(hasConsent(c, "marketing")).toBe(false);
  });

  it("denies everything when no consent is stored", () => {
    expect(hasConsent(null, "analytics")).toBe(false);
    expect(hasConsent(null, "thirdParty")).toBe(false);
  });
});
