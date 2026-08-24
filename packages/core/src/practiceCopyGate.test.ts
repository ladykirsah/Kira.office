import { describe, expect, it } from "vitest";
import { isPracticeCopy, configDeniesPracticeCopy } from "./practiceCopyGate";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The gate on the practice copy's one-click sign-in.
 *
 * What it unlocks hands out a super-admin session with no credential, so it must be provably
 * impossible to satisfy in production. Two conditions, both required — and the second half of the
 * guarantee is the config test at the bottom, which is what makes "production ships PRACTICE_COPY=0"
 * a fact rather than a hope.
 */
describe("isPracticeCopy", () => {
  it("given the opt-in and no Access > then yes", () => {
    expect(isPracticeCopy({ PRACTICE_COPY: "1" })).toBe(true);
  });

  it("given nothing set at all > then no", () => {
    // The default for any environment that has not deliberately asked for this.
    expect(isPracticeCopy({})).toBe(false);
  });

  it("given production's explicit refusal > then no", () => {
    expect(isPracticeCopy({ PRACTICE_COPY: "0" })).toBe(false);
  });

  it("given a half-remembered opt-in value > then no", () => {
    for (const v of ["true", "yes", "on", "01", " 1", "1 ", ""]) {
      expect(isPracticeCopy({ PRACTICE_COPY: v }), JSON.stringify(v)).toBe(false);
    }
  });

  it("given Access is configured > then no, whatever the opt-in says", () => {
    // Anything behind Access is the real shop. This condition can only refuse, never grant.
    expect(isPracticeCopy({ PRACTICE_COPY: "1", ACCESS_AUD: "aud" })).toBe(false);
    expect(
      isPracticeCopy({ PRACTICE_COPY: "1", ACCESS_TEAM_DOMAIN: "x.cloudflareaccess.com" }),
    ).toBe(false);
    expect(isPracticeCopy({ PRACTICE_COPY: "1", ACCESS_AUD: "aud", ACCESS_TEAM_DOMAIN: "x" })).toBe(
      false,
    );
  });
});

describe("configDeniesPracticeCopy", () => {
  it("given every environment setting it to 0 > then ok", () => {
    expect(
      configDeniesPracticeCopy({
        vars: { PRACTICE_COPY: "0" },
        env: { staging: { vars: { PRACTICE_COPY: "0" } } },
      }),
    ).toEqual({ ok: true, missing: [] });
  });

  it("given a named env that forgot it > then it is named", () => {
    expect(
      configDeniesPracticeCopy({
        vars: { PRACTICE_COPY: "0" },
        env: { staging: { vars: {} } },
      }),
    ).toEqual({ ok: false, missing: ["staging"] });
  });

  it("given the top level missing it > then it is named", () => {
    expect(configDeniesPracticeCopy({})).toEqual({ ok: false, missing: ["(top level)"] });
  });

  it("given it set to 1 in a deployed env > then NOT ok", () => {
    // The disaster case: someone copies .dev.vars into the deployed config.
    expect(configDeniesPracticeCopy({ vars: { PRACTICE_COPY: "1" } }).ok).toBe(false);
  });
});

/**
 * The real config file, not a fixture.
 *
 * This is the test that makes the whole design safe: it fails the build if any deployable
 * environment stops explicitly refusing the practice door. Adding a new `env` to wrangler.jsonc
 * without `"vars": { "PRACTICE_COPY": "0" }` breaks here rather than shipping a deployment whose
 * only protection is that nobody happened to set a variable.
 */
describe("the deployed wrangler config", () => {
  it("refuses the practice door in every environment it can deploy", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "../../../wrangler.jsonc"), "utf8");
    // JSONC: strip // line comments and trailing commas before parsing.
    const json = raw.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
    const verdict = configDeniesPracticeCopy(JSON.parse(json));
    expect(verdict.missing).toEqual([]);
    expect(verdict.ok).toBe(true);
  });
});
