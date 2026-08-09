import { describe, it, expect } from "vitest";
import { canSignInAsOwner } from "./ownerSignIn";

const ok = {
  accessConfigured: true,
  verifiedEmail: "lady.kirsah@gmail.com",
  superAdminEmails: "lady.kirsah@gmail.com",
};

describe("canSignInAsOwner", () => {
  it("given a verified owner email on the allowlist > then allowed", () => {
    expect(canSignInAsOwner(ok)).toEqual({ ok: true, email: "lady.kirsah@gmail.com" });
  });

  it("given Access NOT configured > then REFUSED, however tempting the other fields look", () => {
    // The one that matters most. `isSuperAdmin` deliberately returns true when Access is off, so a
    // local dev machine stays usable — reusing that here would mean anyone reaching the API of a
    // misconfigured deployment could mint themselves a super-admin session.
    expect(canSignInAsOwner({ ...ok, accessConfigured: false })).toEqual({
      ok: false,
      reason: "access_not_configured",
    });
  });

  it("given no verified email > then refused", () => {
    expect(canSignInAsOwner({ ...ok, verifiedEmail: null }).ok).toBe(false);
    expect(canSignInAsOwner({ ...ok, verifiedEmail: "" }).ok).toBe(false);
  });

  it("given an EMPTY allowlist > then refused, never opened to everyone", () => {
    // An unset variable is the most likely misconfiguration, so it must fail closed. "No owners
    // listed" must never read as "everyone is an owner".
    for (const list of ["", "   ", undefined]) {
      expect(canSignInAsOwner({ ...ok, superAdminEmails: list }).ok).toBe(false);
    }
  });

  it("given an email NOT on the allowlist > then refused", () => {
    // Passing Access proves who you are, not that you are the owner. Anyone the Access policy lets
    // through would otherwise become a super admin.
    expect(canSignInAsOwner({ ...ok, verifiedEmail: "someone.else@gmail.com" })).toEqual({
      ok: false,
      reason: "not_an_owner",
    });
  });

  it("given odd spacing or casing > then still matched, since people type both", () => {
    expect(
      canSignInAsOwner({
        accessConfigured: true,
        verifiedEmail: "  Lady.Kirsah@Gmail.com ",
        superAdminEmails: "someone@x.com, LADY.KIRSAH@gmail.com",
      }),
    ).toEqual({ ok: true, email: "lady.kirsah@gmail.com" });
  });

  it("given a lookalike that merely CONTAINS the owner address > then refused", () => {
    // Substring matching here would hand the shop to anyone who could register
    // lady.kirsah@gmail.com.attacker.com.
    expect(
      canSignInAsOwner({ ...ok, verifiedEmail: "lady.kirsah@gmail.com.attacker.com" }).ok,
    ).toBe(false);
  });
});
