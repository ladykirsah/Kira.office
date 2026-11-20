import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Expo back office takes over admin.airplusauto.com (owner, 4 Nov 2026: "Publish first", "A: PIN
// every open", then "i want to swap for the old one"): a static export served by its own Worker on
// the same GoGoCash account as the api and storefront, published by CI on every merge to main. The
// old Next.js admin is parked: no longer published, no address.
// Den Air's address is teampit.formulal.cc (owner, 19 Nov 2026: pick B). admin.airplusauto.com still
// loads the app, which forwards each phone there once it holds no unsent bill (src/lib/oldAddress.ts).
const GOGOCASH = "187ab61ed9dbc6e616cb23e6b95aa8f1";
const HOST = "teampit.formulal.cc";
const OLD_HOST = "admin.airplusauto.com";
const HOSTS = [HOST, OLD_HOST];
// Only the Expo export loads its code from here; the old Next.js admin loads /_next/.
const EXPO_MARK = "_expo/static";

const path = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => (existsSync(path(p)) ? readFileSync(path(p), "utf8") : null);

/** wrangler.jsonc as data: whole-line comments and trailing commas removed. */
function readJsonc(p) {
  const text = read(p);
  if (text === null) return null;
  const json = text
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(json);
}

/** One job of ci.yml, from its `  name:` line to the next top-level job. */
function ciJob(name) {
  const ci = read(".github/workflows/ci.yml") ?? "";
  const start = ci.indexOf(`\n  ${name}:\n`);
  if (start === -1) return null;
  const rest = ci.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

/** The `- name:` steps of a job, as text. */
const steps = (job) => job.split(/\n\s*- name: /).slice(1);

describe(`${HOST} hosting`, () => {
  const config = readJsonc("apps/mobile/wrangler.jsonc");

  it("wrangler > serves the exported site from the GoGoCash account, every path to the app", () => {
    expect(config).not.toBeNull();
    expect(config.account_id).toBe(GOGOCASH);
    expect(config.assets.directory).toBe("./dist");
    // Every address (/orders/123, /settings/staff) opens the one page that routes itself.
    expect(config.assets.not_found_handling).toBe("single-page-application");
  });

  it(`wrangler > answers at ${HOST} and ${OLD_HOST}, never at a workers.dev address`, () => {
    // A deploy replaces the Worker's whole address list with this one (wrangler sends
    // override_scope), so an address left out here is taken off the app on the next merge.
    expect(config?.routes).toEqual(HOSTS.map((pattern) => ({ pattern, custom_domain: true })));
    expect(config?.workers_dev).toBe(false);
  });

  it("ci > deploy-app runs only on a merge to main, after the checks", () => {
    const job = ciJob("deploy-app");
    expect(job).not.toBeNull();
    expect(job).toContain("needs: build");
    expect(job).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'");
  });

  it("ci > deploy-app builds with no key and no EXPO_PUBLIC_* override, then uploads", () => {
    const all = steps(ciJob("deploy-app") ?? "");
    const guard = all.findIndex((s) => s.includes("^EXPO_PUBLIC_"));
    const build = all.findIndex((s) => s.includes("expo export --platform web"));
    const upload = all.findIndex((s) => s.includes("wrangler deploy"));

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(guard);
    expect(upload).toBeGreaterThan(build);
    expect(all[build]).not.toContain("CLOUDFLARE_API_TOKEN");
    // A missing token fails the run instead of skipping green, as on the other deploy jobs.
    expect(all[upload]).toContain('if [ -z "$CLOUDFLARE_API_TOKEN" ]');
  });

  it.each(HOSTS)(
    "ci > after the upload, fails unless %s answers with THIS app, not the old admin",
    (host) => {
      // The deploy token may lack zone edit (docs/knowledge/operations/ci-pipeline.md (b)): the known
      // "could not re-assert the custom domain" warning would then pass green while the address still
      // served the old admin — which is also called TeamPit. Only the Expo page proves the swap.
      const all = steps(ciJob("deploy-app") ?? "");
      const upload = all.findIndex((s) => s.includes("wrangler deploy"));
      const check = all.findIndex((s) => s.includes(`https://${host}/`) && s.includes(EXPO_MARK));

      expect(check).toBeGreaterThan(upload);
      expect(all[check]).toContain("exit 1");
    },
  );

  it("build > never reads a .env file, so a local preview's localhost api cannot ship", () => {
    // apps/mobile/.env.local points the preview at the local api; expo export reads it by default.
    const { scripts } = JSON.parse(read("apps/mobile/package.json"));
    const ciBuild = steps(ciJob("deploy-app") ?? "").find((s) => s.includes("expo export"));

    expect(scripts["build:web"]).toMatch(/^EXPO_NO_DOTENV=1 expo export --platform web$/);
    expect(ciBuild).toContain("EXPO_NO_DOTENV=1 npx expo export --platform web");
  });

  it("old admin > removed (plan 1.5–1.6, 18 Nov 2026): no CI job and no config left to deploy it", () => {
    expect(ciJob("deploy-admin")).toBeNull();
    expect(existsSync(path("apps/admin/wrangler.jsonc"))).toBe(false);
  });
});
