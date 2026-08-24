import { describe, it, expect } from "vitest";
import { describePracticeCopy } from "./practiceCopy";

/**
 * 2026-08-24: the owner could not sign in and believed their password was wrong. It was not — they
 * were on a LOCAL practice copy of the admin, which carries its own database and its own staff
 * accounts. The password they typed was the production one; the practice copy's account had been
 * hand-seeded on 26 July with a different password and never updated.
 *
 * Nothing on screen said which copy they were looking at. `DevApiBanner` could not have helped
 * twice over: it only warns about local-admin → REMOTE-api (the opposite mix-up), and it renders
 * inside `AppShell`, which `/login` deliberately skips — so it is invisible on the one page where
 * this confusion happens.
 *
 * This predicate answers a different question from `describeApiMismatch`: not "is your setup
 * broken" but "which copy of the shop am I looking at". Four working copies exist on the owner's
 * machine, each with a separate database and a different password for the same email address.
 */
describe("describePracticeCopy", () => {
  it("given a page served from localhost > says this is a practice copy", () => {
    const notice = describePracticeCopy("localhost");
    expect(notice).not.toBeNull();
    expect(notice!.toLowerCase()).toContain("practice copy");
  });

  it("given 127.0.0.1 > says the same, it is the same machine", () => {
    expect(describePracticeCopy("127.0.0.1")).not.toBeNull();
  });

  it("given a .local hostname > says the same", () => {
    expect(describePracticeCopy("kira.local")).not.toBeNull();
  });

  it("given the deployed admin > silent, that IS the real shop", () => {
    expect(describePracticeCopy("admin.airplusauto.com")).toBeNull();
  });

  it("given the old admin hostname > silent, it is equally real", () => {
    expect(describePracticeCopy("admin.homeseeker.me")).toBeNull();
  });

  it("given the notice > warns that its data and passwords are separate", () => {
    // The whole failure was believing one password should work everywhere.
    const notice = describePracticeCopy("localhost")!;
    expect(notice.toLowerCase()).toMatch(/separate|own/);
    expect(notice.toLowerCase()).toContain("password");
  });

  it("given the notice > names where the real shop is, so there is somewhere to go", () => {
    expect(describePracticeCopy("localhost")).toContain("admin.airplusauto.com");
  });

  it("given an empty hostname > silent rather than crashing the page it wraps", () => {
    // A banner must never be the thing that breaks the page it is warning about.
    expect(describePracticeCopy("")).toBeNull();
  });
});
