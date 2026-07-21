import { describe, it, expect } from "vitest";
import { SECURITY_HEADERS, securityHeaderRules } from "./securityHeaders";

/** Convenience: the policy as a plain map, since order is irrelevant to behaviour. */
const asMap = () => Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key.toLowerCase(), h.value]));

describe("SECURITY_HEADERS", () => {
  it("given any response > forces HTTPS for a year, including subdomains", () => {
    // api. and admin. are on airplusauto.com too and are HTTPS-only, so includeSubDomains is safe.
    // Deliberately NOT preload: that is a public-list submission and is painful to undo.
    const hsts = asMap()["strict-transport-security"];
    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("given a response > refuses MIME sniffing", () => {
    expect(asMap()["x-content-type-options"]).toBe("nosniff");
  });

  it("given a framing attempt > blocks it two ways, for old and modern browsers", () => {
    // X-Frame-Options is the legacy header; frame-ancestors is what current browsers honour.
    // Checkout is the thing being protected here — a clickjacked "confirm order" is a real order.
    expect(asMap()["x-frame-options"]).toBe("DENY");
    expect(asMap()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("given a cross-origin navigation > sends the origin but never the path", () => {
    // Not no-referrer: the shop wants referrer data for SEO/analytics. strict-origin-when-cross-origin
    // keeps the origin while stripping the path, so a product URL never leaks to a third party.
    expect(asMap()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("given a page > denies camera, microphone and geolocation outright", () => {
    const pp = asMap()["permissions-policy"];
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(pp).toContain(feature);
    }
  });

  it("given the CSP > restricts framing ONLY, so it cannot break scripts or images", () => {
    // A full CSP on a Next.js app needs nonces for its inline bootstrap; getting it wrong takes the
    // whole shop down. Framing is the part that is safe to lock today — see the module note.
    const csp = asMap()["content-security-policy"];
    expect(csp).toBe("frame-ancestors 'none'");
  });
});

describe("securityHeaderRules", () => {
  it("given the Next config > applies the policy to every path", async () => {
    const rules = await securityHeaderRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers).toEqual(SECURITY_HEADERS);
  });
});
