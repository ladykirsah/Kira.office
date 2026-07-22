import { describe, it, expect } from "vitest";
import { adminUrlForApiHost } from "./adminUrlForApiHost";

/**
 * The api Worker serves a friendly root page ("this is the API, the admin UI is over there").
 * It hardcoded https://app.homeseeker.me — a hostname that has NO DNS record and never answered.
 * Anyone who followed that link got a dead site, and it would have kept rotting silently.
 *
 * Deriving the admin URL from the request host instead means it stays correct on every hostname the
 * API is reachable on, including ones that do not exist yet — and it survives dropping a domain.
 */
describe("adminUrlForApiHost", () => {
  it("given the production API host > points at the production admin", () => {
    expect(adminUrlForApiHost("api.airplusauto.com")).toBe("https://admin.airplusauto.com");
  });

  it("given the legacy API host > points at the matching legacy admin", () => {
    expect(adminUrlForApiHost("api.homeseeker.me")).toBe("https://admin.homeseeker.me");
  });

  it("given the staging API host > points at the staging admin, not production", () => {
    // Sending someone from staging to the production back office would be worse than a dead link.
    expect(adminUrlForApiHost("staging-api.homeseeker.me")).toBe(
      "https://staging-admin.homeseeker.me",
    );
  });

  it("given localhost > points at the local admin dev server", () => {
    expect(adminUrlForApiHost("localhost")).toBe("http://localhost:3000");
    expect(adminUrlForApiHost("127.0.0.1")).toBe("http://localhost:3000");
  });

  it("given an unrecognised host > falls back to the real admin rather than guessing", () => {
    // A workers.dev URL or a future hostname: a working link beats a clever wrong one.
    expect(adminUrlForApiHost("kiraoffice.myinternal.workers.dev")).toBe(
      "https://admin.airplusauto.com",
    );
  });

  it("given a host with no api- prefix at all > falls back", () => {
    expect(adminUrlForApiHost("example.com")).toBe("https://admin.airplusauto.com");
  });
});
