import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// OpenNext refuses to build a Next.js major more than two years past its release: Next 15
// (2024-10-21) stopped deploying on 2026-10-21, and every admin + storefront deploy failed from
// then on. The stopgap is OpenNext's --dangerouslyUseUnsupportedNextVersion on every build. It
// must be on while an app is on Next 15, and must come OFF once the app moves to 16 or later, so a
// future "not supported" refusal is seen instead of silently overridden.
const FLAG = "--dangerouslyUseUnsupportedNextVersion";
const LAST_UNSUPPORTED_MAJOR = 15;
const APPS = ["admin", "storefront"];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function nextMajor(app) {
  const range = JSON.parse(read(`apps/${app}/package.json`)).dependencies.next;
  return Number(range.match(/\d+/)[0]);
}

// Each `- name:` step of ci.yml that runs an OpenNext build, keyed by its working-directory app.
function ciBuildCommands(app) {
  return read(".github/workflows/ci.yml")
    .split(/\n\s*- name: /)
    .filter((step) => step.includes(`working-directory: apps/${app}\n`))
    .flatMap((step) =>
      step.split("\n").filter((line) => line.includes("opennextjs-cloudflare build")),
    );
}

function scriptBuildCommands(app) {
  const { scripts } = JSON.parse(read(`apps/${app}/package.json`));
  return Object.values(scripts).filter((cmd) => cmd.includes("opennextjs-cloudflare build"));
}

describe("OpenNext build commands", () => {
  for (const app of APPS) {
    const major = nextMajor(app);
    const onUnsupportedNext = major <= LAST_UNSUPPORTED_MAJOR;

    it(`${app} > given Next ${major} > ${onUnsupportedNext ? "every build passes" : "no build passes"} the unsupported-version flag`, () => {
      const ci = ciBuildCommands(app);
      const commands = [...ci, ...scriptBuildCommands(app)];

      expect(ci.length).toBeGreaterThan(0);
      for (const cmd of commands) {
        if (onUnsupportedNext) expect(cmd).toContain(FLAG);
        else expect(cmd).not.toContain(FLAG);
      }
    });
  }
});
