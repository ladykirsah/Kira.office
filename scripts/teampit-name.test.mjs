import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Plan 9.2 (owner, 17 Nov 2026): "no more Kira.office and Crew engine, just TeamPit everywhere".
// This guard fails the build if either old name comes back in the project's files. Left for their
// own steps of the approved rename plan, and nothing else:
//  · the folder path …/Kira.office-main — renamed last, on the Mac (part 5).
// The behind-the-scenes Cloudflare names change with part 4, one at a time (checked below).

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD = /CrewEngine|Crew Engine|Kira\.office/;
// …and the owner's own words that made the decision, quoted where it is recorded.
const LATER = [
  /Kira\.office-main/g,
  /"no more Kira\.office and Crew engine,/g,
];

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((f) => f !== "scripts/teampit-name.test.mjs")
    .filter((f) => !/\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|pdf|zip)$/i.test(f));
}

describe("TeamPit everywhere > no old name left", () => {
  it("given every project file > then no CrewEngine or Kira.office in it", () => {
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

  it("given the old back office (removed in plan step 1.6) > then its folder and every script that ran it are gone", () => {
    expect(trackedFiles().filter((f) => f.startsWith("apps/admin/"))).toEqual([]);
    for (const file of ["package.json", ".claude/launch.json"]) {
      expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(/apps\/admin|@l-shopee\/admin/);
    }
  });

  it("given the project's package > then it is named teampit, in package.json and the lock file", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
    expect(pkg.name).toBe("teampit");
    expect(lock.name).toBe("teampit");
    expect(lock.packages[""].name).toBe("teampit");
  });

  it("given the app > then its name, home-screen name and camera message say TeamPit", () => {
    const app = JSON.parse(readFileSync(join(root, "apps/mobile/app.json"), "utf8")).expo;
    expect(app.name).toBe("TeamPit");
    const camera = app.plugins.find((p) => Array.isArray(p) && p[0] === "expo-camera")[1];
    expect(camera.cameraPermission).toMatch(/^TeamPit /);
  });
});

// Plan 9.2 part 4 (owner, 18 Nov 2026: "Go"): Cloudflare's names, one at a time, each with the
// owner's yes. First the back-office website's server — it stores nothing and nothing points at it.
describe("TeamPit everywhere > Cloudflare names", () => {
  it("given the back-office website's server > then it is teampit-app, and CI's deploy check reads that name", () => {
    const config = readFileSync(join(root, "apps/mobile/wrangler.jsonc"), "utf8");
    expect(config).toMatch(/^\s*"name":\s*"teampit-app",/m);
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain('grep -q "Deployed teampit-app"');
    expect(ci).not.toContain("kiraoffice-app");
  });

  // The main server (owner, 18 Nov 2026: "Go" on the plan). Renamed IN PLACE in the dashboard first,
  // so its secrets, addresses, nightly job and stock-writer namespace stay; then this config ships
  // with the same name. A config name that doesn't match the live server makes wrangler create a
  // second Worker (the 2026-07-20 deadlock) — so the API config, AirPlus's binding and CI's check
  // must all say the same name.
  it("given the main server > then the api config, AirPlus's stock-writer link and CI's check all say teampit-api", () => {
    const api = readFileSync(join(root, "wrangler.jsonc"), "utf8");
    expect(api).toMatch(/^\s*"name":\s*"teampit-api",/m);
    const shop = readFileSync(join(root, "apps/storefront/wrangler.jsonc"), "utf8");
    const links = [...shop.matchAll(/"class_name":\s*"StockLedger",\s*"script_name":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(links[0]).toBe("teampit-api");
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain('grep -q "Deployed teampit-api"');
    expect(ci).not.toContain('"Deployed kiraoffice"');
  });

  // Picture storage (owner, 18 Nov 2026: "Go"). R2 can't be renamed: every file was copied to
  // teampit-images under the same key, then both live servers switched. Staging keeps its own copy.
  it("given the live picture storage > then the api and AirPlus both use teampit-images", () => {
    const live = (file) => {
      const text = readFileSync(join(root, file), "utf8");
      const top = text.split(/^\s*"env":/m)[0];
      return [...top.matchAll(/"binding":\s*"IMAGES",\s*"bucket_name":\s*"([^"]+)"/g)].map((m) => m[1]);
    };
    expect(live("wrangler.jsonc")).toEqual(["teampit-images"]);
    expect(live("apps/storefront/wrangler.jsonc")).toEqual(["teampit-images"]);
  });

  // The old test copy (staging) was retired on 18 Nov 2026 (owner: "Go"): its servers, database,
  // pictures and settings store are deleted, so no settings file may point at them any more.
  it("given the retired test copy > then no settings file or script still points at it", () => {
    const files = ["wrangler.jsonc", "apps/storefront/wrangler.jsonc", "package.json"];
    for (const file of files) {
      const text = readFileSync(join(root, file), "utf8");
      expect(text, file).not.toMatch(/"staging"\s*:|85f22f44|c876509f|images-staging|deploy:staging/);
    }
  });

  // Den Air's database (owner, 18 Nov 2026: "Go"). D1 can't be renamed: it was copied whole to
  // teampit-denair while the shop was closed, then every config that binds `DB` switched together.
  it("given Den Air's live database > then the api, AirPlus and the practice copy all bind teampit-denair", () => {
    const db = (file) => {
      const top = readFileSync(join(root, file), "utf8").split(/^\s*"env":/m)[0];
      const m = top.match(/"binding":\s*"DB",(?:\s*\/\/[^\n]*)*\s*"database_name":\s*"([^"]+)",\s*"database_id":\s*"([^"]+)"/);
      return m && { name: m[1], id: m[2] };
    };
    const want = { name: "teampit-denair", id: "e609101c-78d3-4a80-94a6-0cc5d4625d17" };
    expect(db("wrangler.jsonc")).toEqual(want);
    expect(db("apps/storefront/wrangler.jsonc")).toEqual(want);
    expect(db("wrangler.practice.jsonc")).toEqual(want);
  });
});
