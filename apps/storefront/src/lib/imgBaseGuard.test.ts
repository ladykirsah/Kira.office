import { describe, it, expect } from "vitest";
import { assertDeployableImgBase } from "./imgBaseGuard";

/**
 * 2026-07-22 incident: a `wrangler deploy` ran from a shell where NEXT_PUBLIC_IMG_BASE was still
 * pointing at the local dev server (.claude/launch.json runs wrangler dev on :8788). NEXT_PUBLIC_*
 * is inlined at BUILD time, so every <img> on the live storefront shipped as
 * http://localhost:8788/img/… — every product photo broken for customers, and nothing in the build
 * or the deploy said a word about it.
 *
 * The guard runs in next.config.ts so a production build DIES instead of shipping that.
 */
describe("assertDeployableImgBase > production build", () => {
  const prod = (v: string | undefined) => () => assertDeployableImgBase(v, true);

  it("given the real API host > passes", () => {
    expect(prod("https://api.airplusauto.com")).not.toThrow();
  });

  it("given undefined > passes, because img.ts falls back to the real host", () => {
    // Not setting the var is the NORMAL production path — the fallback in img.ts is the source of
    // truth. Only an explicitly WRONG value is an error.
    expect(prod(undefined)).not.toThrow();
  });

  it("given the previous API host > passes, since that hostname still serves images", () => {
    expect(prod("https://api.homeseeker.me")).not.toThrow();
  });

  it("given the exact value that broke production > throws", () => {
    expect(prod("http://localhost:8788")).toThrow(/localhost:8788/);
  });

  it("given any loopback spelling > throws", () => {
    for (const v of [
      "http://localhost:3000",
      "http://127.0.0.1:8788",
      "http://[::1]:8788",
      "http://0.0.0.0:8788",
      "http://my-mac.local:8788",
    ]) {
      expect(prod(v), `expected ${v} to be rejected`).toThrow();
    }
  });

  it("given a plain-http public host > throws, because browsers block mixed content on an https page", () => {
    expect(prod("http://api.airplusauto.com")).toThrow();
  });

  it("given a thrown error > names the variable and how to fix it", () => {
    // The whole point is that the next person reads the failure and knows what to do, rather than
    // discovering it from broken images on the live site hours later.
    expect(prod("http://localhost:8788")).toThrow(/NEXT_PUBLIC_IMG_BASE/);
    expect(prod("http://localhost:8788")).toThrow(/unset/i);
  });
});

describe("assertDeployableImgBase > dev build", () => {
  it("given localhost during local dev > passes, since that is the point of the override", () => {
    expect(() => assertDeployableImgBase("http://localhost:8788", false)).not.toThrow();
  });
});
