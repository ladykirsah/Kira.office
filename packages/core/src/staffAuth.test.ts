import { describe, it, expect } from "vitest";
import {
  STAFF_ROLES,
  isStaffRole,
  hashPassword,
  verifyPassword,
  randomPassword,
  PASSWORD_ITERATIONS,
  passwordProblem,
  canManageStaff,
  canViewFinance,
  canViewSlips,
  canRefund,
  canReviewClaimRole,
  canReviewPaymentRole,
  canWrite,
  scanModesFor,
  encryptSecret,
  decryptSecret,
  pinLookup,
  type StaffRole,
} from "./staffAuth";

describe("STAFF_ROLES", () => {
  it("is exactly the three roles the business has", () => {
    expect(STAFF_ROLES).toEqual(["super_admin", "admin", "mechanic"]);
  });

  it("rejects anything else, including the dead AppRole words", () => {
    expect(isStaffRole("super_admin")).toBe(true);
    expect(isStaffRole("owner")).toBe(false); // the vocabulary this replaces
    expect(isStaffRole("manager")).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });
});

describe("password hashing", () => {
  it("given the right password > verifies", async () => {
    const stored = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(true);
  });

  it("given the wrong password > does not verify", async () => {
    const stored = await hashPassword("correct horse battery");
    await expect(verifyPassword("Correct horse battery", stored)).resolves.toBe(false);
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });

  it("never stores the password itself, and salts every hash differently", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a.hash).not.toContain("same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash); // same input, different salt => different hash
  });

  it("records the iteration count with the hash, so it can be raised later", async () => {
    const stored = await hashPassword("x");
    expect(stored.iterations).toBe(PASSWORD_ITERATIONS);
  });

  it("verifies against the iteration count stored on the row, not today's constant", async () => {
    // An account hashed when the constant was lower must still be able to log in.
    const legacy = await hashPassword("x", { iterations: 1000 });
    expect(legacy.iterations).toBe(1000);
    await expect(verifyPassword("x", legacy)).resolves.toBe(true);
  });

  it("given a row with no password set > refuses rather than letting anyone in", async () => {
    await expect(
      verifyPassword("anything", { hash: null, salt: null, iterations: null }),
    ).resolves.toBe(false);
    await expect(verifyPassword("", { hash: "", salt: "", iterations: 0 })).resolves.toBe(false);
  });
});

describe("randomPassword", () => {
  it("is long enough to be worth generating and differs every time", () => {
    const a = randomPassword();
    const b = randomPassword();
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(a).not.toBe(b);
  });

  it("passes our own password rules", () => {
    expect(passwordProblem(randomPassword())).toBeNull();
  });
});

describe("passwordProblem", () => {
  it("rejects a password too short to bother with", () => {
    expect(passwordProblem("short")).toContain("8");
  });

  it("rejects blank and whitespace-only", () => {
    expect(passwordProblem("")).not.toBeNull();
    expect(passwordProblem("         ")).not.toBeNull();
  });

  it("accepts a reasonable one", () => {
    expect(passwordProblem("somchai-2026-aircon")).toBeNull();
  });
});

describe("permissions", () => {
  const roles: StaffRole[] = ["super_admin", "admin", "mechanic"];
  const allow = (fn: (r: StaffRole) => boolean) => roles.filter(fn);

  it("only the super admin manages staff", () => {
    expect(allow(canManageStaff)).toEqual(["super_admin"]);
  });

  it("only the super admin sees Finance, bank slips and refunds (owner, 2026-08-03)", () => {
    expect(allow(canViewFinance)).toEqual(["super_admin"]);
    expect(allow(canViewSlips)).toEqual(["super_admin"]);
    expect(allow(canRefund)).toEqual(["super_admin"]);
  });

  it("a mechanic assesses claims; payment approval is never theirs", () => {
    expect(allow(canReviewClaimRole)).toEqual(["super_admin", "admin", "mechanic"]);
    expect(allow(canReviewPaymentRole)).toEqual(["super_admin", "admin"]);
  });

  it("a mechanic may look at products and customers but not change them", () => {
    expect(canWrite("mechanic", "products")).toBe(false);
    expect(canWrite("mechanic", "customers")).toBe(false);
    expect(canWrite("admin", "products")).toBe(true);
    expect(canWrite("super_admin", "customers")).toBe(true);
  });

  it("a mechanic may still do the counter work that needs writing", () => {
    expect(canWrite("mechanic", "pos")).toBe(true);
    expect(canWrite("mechanic", "payment")).toBe(true);
    expect(canWrite("mechanic", "stock")).toBe(true);
  });
});

describe("scanModesFor", () => {
  it("a mechanic gets every mode except adding a product (owner, 2026-08-03)", () => {
    expect(scanModesFor("mechanic")).toEqual(["view", "hold", "fill", "pos"]);
  });

  it("admin and super admin get all five", () => {
    expect(scanModesFor("admin")).toEqual(["add", "view", "hold", "fill", "pos"]);
    expect(scanModesFor("super_admin")).toEqual(["add", "view", "hold", "fill", "pos"]);
  });
});

describe("password the owner can read back", () => {
  // The owner asked twice to be able to reveal any staff password. This is how: encrypted under a
  // key that lives in a Worker secret, never in the database.
  const KEY = "9f".repeat(32); // 32 bytes of key material as hex

  it("what goes in comes back out", async () => {
    const cipher = await encryptSecret("Kira-4821-somchai", KEY);
    await expect(decryptSecret(cipher, KEY)).resolves.toBe("Kira-4821-somchai");
  });

  it("the stored value does not contain the password", async () => {
    const cipher = await encryptSecret("Kira-4821-somchai", KEY);
    expect(cipher).not.toContain("Kira");
    expect(cipher).not.toContain("somchai");
  });

  it("encrypting the same password twice gives different stored values", async () => {
    // A fresh random IV each time, so two staff with the same password are not visibly identical.
    const a = await encryptSecret("same-password", KEY);
    const b = await encryptSecret("same-password", KEY);
    expect(a).not.toBe(b);
    await expect(decryptSecret(b, KEY)).resolves.toBe("same-password");
  });

  it("the wrong key reveals nothing — it fails rather than returning rubbish", async () => {
    const cipher = await encryptSecret("Kira-4821-somchai", KEY);
    await expect(decryptSecret(cipher, "ab".repeat(32))).resolves.toBeNull();
  });

  it("tampered ciphertext is refused, not silently accepted", async () => {
    const cipher = await encryptSecret("Kira-4821-somchai", KEY);
    const flipped = cipher.slice(0, -4) + (cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    await expect(decryptSecret(flipped, KEY)).resolves.toBeNull();
  });

  it("a row with nothing stored reveals nothing", async () => {
    await expect(decryptSecret(null, KEY)).resolves.toBeNull();
    await expect(decryptSecret("", KEY)).resolves.toBeNull();
  });
});

describe("pinLookup", () => {
  const PEPPER = "pepper-from-a-worker-secret";

  it("is stable, so the same PIN always finds the same person", async () => {
    expect(await pinLookup("481920", PEPPER)).toBe(await pinLookup("481920", PEPPER));
  });

  it("differs per PIN, so the unique index really stops two people sharing six digits", async () => {
    expect(await pinLookup("481920", PEPPER)).not.toBe(await pinLookup("481921", PEPPER));
  });

  it("is useless without the pepper — a stolen database can't be scanned for PINs", async () => {
    expect(await pinLookup("481920", PEPPER)).not.toBe(await pinLookup("481920", "other-pepper"));
  });

  it("never contains the PIN itself", async () => {
    expect(await pinLookup("481920", PEPPER)).not.toContain("481920");
  });
});
