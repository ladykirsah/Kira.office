import { describe, it, expect } from "vitest";
import { isSuperAdmin, privateFileAccess } from "./access";

describe("isSuperAdmin", () => {
  it("Access off (local dev) > anyone is treated as super-admin", () => {
    expect(isSuperAdmin(null, { accessConfigured: false })).toBe(true);
    expect(isSuperAdmin("nobody@x.com", { accessConfigured: false, superAdminEmails: "" })).toBe(
      true,
    );
  });

  it("Access on, email on the list > super-admin", () => {
    expect(
      isSuperAdmin("boss@airplus.com", {
        accessConfigured: true,
        superAdminEmails: "boss@airplus.com, other@airplus.com",
      }),
    ).toBe(true);
  });

  it("Access on, email not on the list > not super-admin", () => {
    expect(
      isSuperAdmin("staff@airplus.com", {
        accessConfigured: true,
        superAdminEmails: "boss@airplus.com",
      }),
    ).toBe(false);
  });

  it("Access on, no list configured > nobody is super-admin", () => {
    expect(isSuperAdmin("boss@airplus.com", { accessConfigured: true })).toBe(false);
    expect(isSuperAdmin("boss@airplus.com", { accessConfigured: true, superAdminEmails: "" })).toBe(
      false,
    );
  });

  it("Access on, no email > not super-admin", () => {
    expect(
      isSuperAdmin(null, { accessConfigured: true, superAdminEmails: "boss@airplus.com" }),
    ).toBe(false);
  });

  it("matching ignores case and surrounding whitespace", () => {
    expect(
      isSuperAdmin("  Boss@Airplus.com ", {
        accessConfigured: true,
        superAdminEmails: "boss@airplus.com",
      }),
    ).toBe(true);
  });
});

describe("privateFileAccess", () => {
  const superCtx = { accessConfigured: true, superAdminEmails: "boss@x.com" };

  it("claim evidence > any authenticated admin may read it", () => {
    expect(privateFileAccess("claim/o1/1.jpg", { email: "staff@x.com", ...superCtx })).toBe("ok");
  });

  it("payment slip > super-admin may read it", () => {
    expect(privateFileAccess("slip/o1/1.jpg", { email: "boss@x.com", ...superCtx })).toBe("ok");
  });

  it("payment slip > a non-super admin is forbidden", () => {
    expect(privateFileAccess("slip/o1/1.jpg", { email: "staff@x.com", ...superCtx })).toBe(
      "forbidden",
    );
  });

  it("payment slip > Access off (local dev) serves it", () => {
    expect(privateFileAccess("slip/o1/1.jpg", { email: null, accessConfigured: false })).toBe("ok");
  });

  it("any other namespace > refused outright (no key can reach it)", () => {
    for (const key of ["products/x.jpg", "backups/db.json", "", "slipmalicious/x", "claimant/x"]) {
      expect(privateFileAccess(key, { email: "boss@x.com", ...superCtx })).toBe("not_allowed");
    }
  });
});
