import { describe, it, expect } from "vitest";
import {
  ANONYMIZED_NAME,
  anonymizeStorefrontCustomer,
  generateCustomerCode,
  isCustomerCode,
} from "./storefrontCustomers";

describe("generateCustomerCode", () => {
  it("given a new account > produces an AP-prefixed code the customer can read aloud", () => {
    expect(generateCustomerCode()).toMatch(/^AP-[0-9A-F]{8}$/);
  });

  it("given many accounts > draws from the whole 32-bit space, so repeats are vanishingly rare", () => {
    // NOT `toBe(SAMPLE)`. The generator is 4 random bytes; it has never promised zero collisions —
    // the UNIQUE index on the column is what makes one fail loudly (see generateCustomerCode).
    // Demanding a perfect sample asserted something the code does not guarantee, and 5000 draws
    // from 2^32 collide 0.29% of the time (~1 CI run in 344). It duly broke a deploy on 2026-07-29.
    // Allowing a single duplicate drops that to ~1 in 236,000 runs while keeping the real teeth:
    // a generator drawing from a narrower space than it claims still fails this by a mile.
    const SAMPLE = 5000;
    const codes = new Set(Array.from({ length: SAMPLE }, () => generateCustomerCode()));

    expect(codes.size).toBeGreaterThanOrEqual(SAMPLE - 1);
  });

  it("uses an alphabet with no letters that can be misread as digits", () => {
    const codes = Array.from({ length: 200 }, () => generateCustomerCode()).join("");

    // Hex is 0-9A-F: no O/0, no I/1, no L confusion when read over the phone or LINE.
    expect(codes.replace(/^AP-|AP-/g, "")).not.toMatch(/[OIL]/);
  });
});

describe("isCustomerCode", () => {
  it("accepts a generated code", () => {
    expect(isCustomerCode(generateCustomerCode())).toBe(true);
  });

  it("rejects near-misses so a typo never silently matches the wrong customer", () => {
    expect(isCustomerCode("AP-3F7A2C9")).toBe(false); // too short
    expect(isCustomerCode("ap-3f7a2c91")).toBe(false); // lowercase
    expect(isCustomerCode("3F7A2C91")).toBe(false); // no prefix
    expect(isCustomerCode("")).toBe(false);
  });
});

describe("anonymizeStorefrontCustomer", () => {
  it("given a customer, clears identity but keeps the id so orders stay linked", () => {
    const patch = anonymizeStorefrontCustomer({ id: "cus_123", at: 1_700_000_000_000 });

    expect(patch.id).toBe("cus_123");
    expect(patch.name).not.toBe("");
    expect(patch.email).toBeNull();
    expect(patch.lineUserId).toBeNull();
    expect(patch.facebookId).toBeNull();
    expect(patch.passwordHash).toBeNull();
  });

  it("given two customers, produces distinct phones so the UNIQUE index still holds", () => {
    const a = anonymizeStorefrontCustomer({ id: "cus_a", at: 1 });
    const b = anonymizeStorefrontCustomer({ id: "cus_b", at: 1 });

    expect(a.phone).not.toBe(b.phone);
  });

  it("given any customer, the erased phone can never collide with a real Thai number", () => {
    const patch = anonymizeStorefrontCustomer({ id: "cus_a", at: 1 });

    expect(patch.phone).not.toMatch(/^[0-9+]/);
  });

  it("given any customer, the erased name is distinct from the not-captured-yet sentinel", () => {
    const patch = anonymizeStorefrontCustomer({ id: "cus_a", at: 1 });

    expect(patch.name).toBe(ANONYMIZED_NAME);
    expect(ANONYMIZED_NAME).not.toBe("");
  });
});
