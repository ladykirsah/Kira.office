import { describe, it, expect } from "vitest";
import { assertDeployableApiBase } from "./apiBaseGuard";

/**
 * The admin's twin of the storefront's imgBaseGuard, flagged as a gap when that one shipped.
 *
 * NEXT_PUBLIC_API_BASE is inlined at BUILD time. A production build run from a shell that still had
 * it pointing at a dev server would ship an admin that calls `http://localhost:8799` from every
 * browser — every page dead, and nothing in the build, the tests or the deploy would say a word.
 * That is not hypothetical: the storefront shipped exactly that bug with NEXT_PUBLIC_IMG_BASE on
 * 2026-07-22 and broke every product photo for ~16 hours.
 */
describe("assertDeployableApiBase > production build", () => {
  const prod = (v: string | undefined) => () => assertDeployableApiBase(v, true);

  it("given the production API > passes", () => {
    expect(prod("https://api.airplusauto.com")).not.toThrow();
  });

  it("given the staging API > passes, that is a real deploy target", () => {
    expect(prod("https://staging-api.homeseeker.me")).not.toThrow();
  });

  it("given undefined > passes, because apiFetch falls back to the real host", () => {
    expect(prod(undefined)).not.toThrow();
  });

  it("given a dev server > throws, naming the variable", () => {
    expect(prod("http://localhost:8799")).toThrow(/NEXT_PUBLIC_API_BASE/);
    expect(prod("http://127.0.0.1:8787")).toThrow();
  });

  it("given plain http on a public host > throws, mixed content would block every call", () => {
    expect(prod("http://api.airplusauto.com")).toThrow();
  });

  it("given junk > throws rather than shipping it", () => {
    expect(prod("not a url")).toThrow();
  });
});

describe("assertDeployableApiBase > dev build", () => {
  it("given localhost during dev > passes, that is the whole point of the override", () => {
    expect(() => assertDeployableApiBase("http://localhost:8799", false)).not.toThrow();
  });
});
