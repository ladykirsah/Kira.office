import { describe, it, expect } from "vitest";
import {
  isSuperAdmin,
  privateFileAccess,
  viewerRole,
  canReviewClaim,
  canReviewPayment,
} from "./access";

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
  /**
   * The namespace policy only. WHO the caller is arrives as a single capability, decided by the
   * route from the staff session — this function no longer knows about emails or env lists.
   *
   * That is the point of the 2026-08-24 change: the old signature took an Access email plus
   * `accessConfigured`, and returned "ok" for a bank slip whenever Access was unconfigured. A
   * fail-open default on customer bank PII is the wrong default however unlikely the state, and
   * the Access email had stopped naming the person operating the admin anyway.
   */
  it("claim evidence > any signed-in staff may read it", () => {
    expect(privateFileAccess("claim/o1/1.jpg", false)).toBe("ok");
  });

  it("payment slip > readable by someone who may see slips", () => {
    expect(privateFileAccess("slip/o1/1.jpg", true)).toBe("ok");
  });

  it("payment slip > forbidden to everyone else", () => {
    expect(privateFileAccess("slip/o1/1.jpg", false)).toBe("forbidden");
  });

  it("refund slip (our outgoing transfer proof) > any signed-in staff may read it", () => {
    // Not customer bank PII — it is proof WE paid the customer back, and the customer sees it too
    // on their order page. So it reads like claim evidence: not slip-gated.
    expect(privateFileAccess("refund-slip/o1/1.jpg", false)).toBe("ok");
  });

  it("refund-slip is matched before slip, so the hyphen cannot be mistaken for the PII namespace", () => {
    expect(privateFileAccess("refund-slip/o1/1.jpg", false)).toBe("ok");
    expect(privateFileAccess("slip/o1/1.jpg", false)).toBe("forbidden");
  });

  it("any other namespace > refused outright, even for someone who may see slips", () => {
    for (const key of ["products/x.jpg", "backups/db.json", "", "slipmalicious/x", "claimant/x"]) {
      expect(privateFileAccess(key, true)).toBe("not_allowed");
    }
  });
});

describe("viewerRole", () => {
  const ctx = {
    accessConfigured: true,
    superAdminEmails: "boss@x.com",
    mechanicEmails: "mech@x.com, wrench@x.com",
  };

  it("a super-admin email > super_admin", () => {
    expect(viewerRole("boss@x.com", ctx)).toBe("super_admin");
  });

  it("a mechanic email > mechanic", () => {
    expect(viewerRole("wrench@x.com", ctx)).toBe("mechanic");
  });

  it("any other authenticated email > admin", () => {
    expect(viewerRole("staff@x.com", ctx)).toBe("admin");
  });

  it("super-admin wins when an email is on both lists", () => {
    expect(viewerRole("boss@x.com", { ...ctx, mechanicEmails: "boss@x.com" })).toBe("super_admin");
  });

  it("case- and space-insensitive, like the super-admin gate", () => {
    expect(viewerRole("  Mech@X.com ", ctx)).toBe("mechanic");
  });

  it("Access off (local dev) > super_admin, so every Zone-A block is exercisable", () => {
    expect(viewerRole(null, { accessConfigured: false })).toBe("super_admin");
  });
});

describe("Zone-A rights by role", () => {
  it("claim review = super-admin + mechanic only (a plain admin is read-only)", () => {
    expect(canReviewClaim("super_admin")).toBe(true);
    expect(canReviewClaim("mechanic")).toBe(true);
    expect(canReviewClaim("admin")).toBe(false);
  });

  it("payment / COD review = super-admin + admin, never a mechanic", () => {
    expect(canReviewPayment("super_admin")).toBe(true);
    expect(canReviewPayment("admin")).toBe(true);
    expect(canReviewPayment("mechanic")).toBe(false);
  });
});
