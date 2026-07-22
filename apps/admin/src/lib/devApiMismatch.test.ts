import { describe, it, expect } from "vitest";
import { describeApiMismatch } from "./devApiMismatch";

/**
 * 2026-07-22: the owner spent a session convinced production data had been lost. Three admin pages
 * looked broken — "Failed to load shop info (HTTP 401)", "No values yet", "Add a brand to get
 * started" — while production actually held 9 part brands, 10 car brands and 106 car models.
 *
 * They were on a local dev server. It proxies to the PRODUCTION API, which requires a Cloudflare
 * Access token; localhost is not behind Access, so every request 401s. The pages that render an
 * empty state instead of an error made it look like missing data rather than failed auth.
 *
 * This predicate spots that exact setup so the admin can say so out loud.
 */
describe("describeApiMismatch", () => {
  it("given localhost admin pointed at the production API > warns", () => {
    const msg = describeApiMismatch("localhost", "https://api.airplusauto.com");
    expect(msg).not.toBeNull();
    expect(msg).toContain("api.airplusauto.com");
  });

  it("given 127.0.0.1 > warns too, since it is the same situation", () => {
    expect(describeApiMismatch("127.0.0.1", "https://api.airplusauto.com")).not.toBeNull();
  });

  it("given the deployed admin on its real hostname > silent", () => {
    // In production Access DOES supply the token, so there is nothing to warn about.
    expect(describeApiMismatch("admin.airplusauto.com", "https://api.airplusauto.com")).toBeNull();
  });

  it("given the old admin hostname > silent, it is equally legitimate", () => {
    expect(describeApiMismatch("admin.homeseeker.me", "https://api.homeseeker.me")).toBeNull();
  });

  it("given localhost admin pointed at a LOCAL api > silent, that is the correct dev setup", () => {
    expect(describeApiMismatch("localhost", "http://localhost:8799")).toBeNull();
    expect(describeApiMismatch("localhost", "http://127.0.0.1:8787")).toBeNull();
  });

  it("given a malformed apiBase > silent rather than crashing the layout", () => {
    // A banner must never be the thing that breaks the page it is warning about.
    expect(describeApiMismatch("localhost", "not a url")).toBeNull();
    expect(describeApiMismatch("localhost", "")).toBeNull();
  });

  it("given the warning > names the fix, not just the problem", () => {
    const msg = describeApiMismatch("localhost", "https://api.airplusauto.com")!;
    expect(msg).toMatch(/admin\.airplusauto\.com|NEXT_PUBLIC_API_BASE/);
  });
});
