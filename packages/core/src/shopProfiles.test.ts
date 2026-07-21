import { describe, it, expect } from "vitest";
import {
  SHOP_PROFILES,
  SHOP_PROFILE_LABELS,
  isShopProfile,
  shopKey,
  parseShopProfile,
} from "./shopProfiles";

describe("SHOP_PROFILES", () => {
  it("has exactly the two businesses, and they are separate", () => {
    expect(SHOP_PROFILES).toEqual(["denair", "airplus"]);
  });

  it("labels each profile for the admin tab strip", () => {
    expect(SHOP_PROFILE_LABELS.denair).toBe("Den Air Service");
    expect(SHOP_PROFILE_LABELS.airplus).toBe("AirPlus");
  });
});

describe("shopKey", () => {
  it("namespaces a field under its profile", () => {
    expect(shopKey("denair", "name")).toBe("shop:denair:name");
    expect(shopKey("airplus", "paymentMethods")).toBe("shop:airplus:paymentMethods");
  });

  it("keeps the two profiles' keys distinct for the SAME field", () => {
    // The whole point: one shop's bank account must never be readable as the other's.
    expect(shopKey("denair", "paymentMethods")).not.toBe(shopKey("airplus", "paymentMethods"));
  });

  it("never collides with the OLD unnamespaced keys", () => {
    // Legacy readers used `shop:name`. A namespaced key must not look like one, or a stale reader
    // would silently pick up the wrong shop's data.
    expect(shopKey("denair", "name")).not.toBe("shop:name");
  });
});

describe("isShopProfile", () => {
  it("accepts the known profiles", () => {
    expect(isShopProfile("denair")).toBe(true);
    expect(isShopProfile("airplus")).toBe(true);
  });

  it("rejects anything else, including path-traversal-ish input", () => {
    // The profile arrives from a URL segment and is concatenated into a KV key, so it must be
    // validated against the allow-list rather than trusted.
    expect(isShopProfile("denair:airplus")).toBe(false);
    expect(isShopProfile("../airplus")).toBe(false);
    expect(isShopProfile("DENAIR")).toBe(false);
    expect(isShopProfile("")).toBe(false);
  });
});

describe("parseShopProfile", () => {
  it("returns the profile when valid", () => {
    expect(parseShopProfile("airplus")).toBe("airplus");
  });

  it("returns null for an unknown profile so the caller can 404 rather than guess", () => {
    expect(parseShopProfile("shopee")).toBeNull();
    expect(parseShopProfile(undefined)).toBeNull();
  });
});
