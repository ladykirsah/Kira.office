import { describe, it, expect } from "vitest";
import { resolveBrandLogo } from "./brandLogo";

describe("resolveBrandLogo", () => {
  it("given an owner-uploaded cover > uses it, ignoring the bundled logo", () => {
    // Regression guard: /search dropped imageKey entirely and always read the bundled map, so a
    // logo uploaded in admin appeared on / and /brands but NOT on /search — it looked broken.
    expect(resolveBrandLogo("Toyota", "taxonomy/car-brand-toyota-abc.png")).toBe(
      "https://api.homeseeker.me/img/taxonomy/car-brand-toyota-abc.png",
    );
  });

  it("given no upload but a bundled logo > falls back to the bundled file", () => {
    expect(resolveBrandLogo("Toyota", null)).toBe("/brands/toyota.png");
  });

  it("given neither > returns null so the caller renders the placeholder", () => {
    expect(resolveBrandLogo("Hyundai", null)).toBeNull();
  });

  it("given an unmapped brand WITH an upload > still uses the upload", () => {
    // The whole point: a brand the bundled map never heard of is fully owner-managed.
    expect(resolveBrandLogo("Hyundai", "taxonomy/car-brand-hyundai-xyz.png")).toBe(
      "https://api.homeseeker.me/img/taxonomy/car-brand-hyundai-xyz.png",
    );
  });

  it("given an empty-string imageKey > treats it as absent, not as a valid key", () => {
    expect(resolveBrandLogo("Toyota", "")).toBe("/brands/toyota.png");
  });
});
