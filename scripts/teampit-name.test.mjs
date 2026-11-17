import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Plan 9.2 (owner, 17 Nov 2026): "no more Kira.office and Crew engine, just TeamPit everywhere".
// This guard fails the build if either old name comes back in the project's files. Left for their
// own steps of the approved rename plan, and nothing else:
//  · apps/admin — the old back office, deleted in plan step 1.5;
//  · the GitHub address ladykirsah/Kira.office — renamed with the GitHub project (part 3);
//  · the folder path …/Kira.office-main — renamed last, on the Mac (part 5).
// The behind-the-scenes Cloudflare names (kiraoffice…) change with part 4, one at a time.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD = /CrewEngine|Crew Engine|Kira\.office/;
// …and the owner's own words that made the decision, quoted where it is recorded.
const LATER = [
  /ladykirsah\/Kira\.office/g,
  /Kira\.office-main/g,
  /"no more Kira\.office and Crew engine,/g,
];

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((f) => !f.startsWith("apps/admin/"))
    .filter((f) => f !== "scripts/teampit-name.test.mjs")
    .filter((f) => !/\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|zip)$/i.test(f));
}

describe("TeamPit everywhere > no old name left", () => {
  it("given every project file (but the old back office) > then no CrewEngine or Kira.office in it", () => {
    const left = [];
    for (const file of trackedFiles()) {
      let text;
      try {
        text = readFileSync(join(root, file), "utf8");
      } catch {
        continue;
      }
      text.split("\n").forEach((line, i) => {
        const rest = LATER.reduce((l, later) => l.replace(later, ""), line);
        if (OLD.test(rest)) left.push(`${file}:${i + 1}`);
      });
    }
    expect(left).toEqual([]);
  });

  it("given the app > then its name, home-screen name and camera message say TeamPit", () => {
    const app = JSON.parse(readFileSync(join(root, "apps/mobile/app.json"), "utf8")).expo;
    expect(app.name).toBe("TeamPit");
    const camera = app.plugins.find((p) => Array.isArray(p) && p[0] === "expo-camera")[1];
    expect(camera.cameraPermission).toMatch(/^TeamPit /);
  });
});
