import { describe, it, expect } from "vitest";
import { isIndexableHost, robotsBody, ROBOTS_NOINDEX_HEADER } from "./indexability";

/**
 * Staging is about to become publicly reachable (the fixed dev OTP is gone, so nobody can log in,
 * but the catalogue is browsable). A public copy of the shop that Google can index is duplicate
 * content competing with the real store — and worse, a customer could land on it and try to order.
 *
 * So: only the real storefront hostname is indexable. Everything else says no, twice — robots.txt
 * AND an X-Robots-Tag header, because robots.txt is advisory and the header is not.
 */
describe("isIndexableHost", () => {
  it("given the real storefront > indexable", () => {
    expect(isIndexableHost("airplusauto.com")).toBe(true);
    expect(isIndexableHost("www.airplusauto.com")).toBe(true);
  });

  it("given staging > NOT indexable, on either zone", () => {
    expect(isIndexableHost("staging-shop.homeseeker.me")).toBe(false);
    // Staging moved onto the production zone (2026-07-22) so homeseeker.me can lapse. A SUBDOMAIN
    // of the indexable host must still be refused — this only holds because the allow-list is an
    // exact match. A suffix check would silently start indexing staging.
    expect(isIndexableHost("staging-shop.airplusauto.com")).toBe(false);
    expect(isIndexableHost("staging-admin.airplusauto.com")).toBe(false);
  });

  it("given a workers.dev preview > NOT indexable", () => {
    expect(isIndexableHost("airplus-storefront-staging.myinternal.workers.dev")).toBe(false);
  });

  it("given localhost > NOT indexable", () => {
    expect(isIndexableHost("localhost")).toBe(false);
  });

  it("given a lookalike domain > NOT indexable", () => {
    // Allow-list, never a substring match: "airplusauto.com.evil.example" must not slip through.
    expect(isIndexableHost("airplusauto.com.evil.example")).toBe(false);
    expect(isIndexableHost("notairplusauto.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isIndexableHost("AirPlusAuto.com")).toBe(true);
  });
});

describe("robotsBody", () => {
  it("given production > allows crawling and points at the sitemap", () => {
    const body = robotsBody("https://airplusauto.com");
    expect(body).toContain("Allow: /");
    expect(body).toContain("Sitemap: https://airplusauto.com/sitemap.xml");
    expect(body).toContain("Disallow: /checkout");
  });

  it("given staging > disallows EVERYTHING and offers no sitemap", () => {
    const body = robotsBody("https://staging-shop.homeseeker.me");
    expect(body).toContain("Disallow: /");
    expect(body).not.toContain("Allow: /");
    // Advertising a sitemap would invite the crawl this is meant to prevent.
    expect(body).not.toContain("Sitemap:");
  });
});

describe("ROBOTS_NOINDEX_HEADER", () => {
  it("tells crawlers not to index or follow", () => {
    // robots.txt is advisory; this header is the one that actually binds.
    expect(ROBOTS_NOINDEX_HEADER).toContain("noindex");
    expect(ROBOTS_NOINDEX_HEADER).toContain("nofollow");
  });
});
