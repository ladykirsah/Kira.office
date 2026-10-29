import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The back office's name, as people see it. The owner renamed it on 2026-10-29: "Kira.office" was
 * a quick name made from their own name, and the new one is "CrewEngine".
 *
 * Only the name people READ changes. The hidden ids keep the old spelling on purpose — the
 * `kira_staff` cookie (renaming it signs every staff member out), the `kira-pos` offline store
 * (renaming it can strand sales not yet sent), the `kiraoffice` Worker and the `kira-office`
 * database — so this test looks for the old NAME, not the word "kira".
 */
const OLD_NAME = "Kira.office";
const NEW_NAME = "CrewEngine";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Everything a staff member can see: both apps' screens, the Expo app's own settings, the tab icon. */
const SHOWN = ["apps/admin/src", "apps/mobile/src", "apps/mobile/app.json"];

function filesUnder(rel: string): string[] {
  const abs = join(REPO, rel);
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isFile()) return [rel];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesUnder(join(rel, e.name))
      : /\.(tsx?|svg|json)$/.test(e.name) && !e.name.includes(".test.")
        ? [join(rel, e.name)]
        : [],
  );
}

/** Comments are notes for us, not text on a screen; they may keep telling the old name's history. */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function linesNaming(name: string, rel: string): string[] {
  return withoutComments(read(rel))
    .split("\n")
    .flatMap((line, i) => (line.includes(name) ? [`${rel}:${i + 1}`] : []));
}

describe("app name", () => {
  it("actually reads the screens", () => {
    expect(SHOWN.flatMap(filesUnder).length).toBeGreaterThan(100);
  });

  it("given any screen > never shows the old name Kira.office", () => {
    expect(SHOWN.flatMap(filesUnder).flatMap((f) => linesNaming(OLD_NAME, f))).toEqual([]);
  });

  it("given the places that carry the name > each shows CrewEngine", () => {
    const carriers = [
      "apps/admin/src/app/Sidebar.tsx",
      "apps/admin/src/app/MobileNav.tsx",
      "apps/admin/src/app/layout.tsx",
      "apps/admin/src/app/login/page.tsx",
      "apps/admin/src/app/recover/page.tsx",
      "apps/admin/src/app/icon.svg",
      "apps/mobile/app.json",
      "apps/mobile/src/app/sign-in.tsx",
      "apps/mobile/src/ui/Shell.tsx",
    ];
    expect(carriers.filter((f) => linesNaming(NEW_NAME, f).length === 0)).toEqual([]);
  });

  /**
   * The name is lettered in Space Grotesk, the font of the turbo logo the owner picked (2026-10-29:
   * "go for C, but just the plain text with that font"). Only the name, in one colour; every other
   * word keeps the app's own font. A screen that shows the name in the plain font is the miss.
   */
  it("given the places that show the name > each letters it in the brand font", () => {
    const css = read("apps/admin/src/app/globals.css");
    const usesBrandFont = (selector: string) =>
      rulesFor(css, selector).some((body) => body.includes("var(--font-brand)"));
    const misses = [
      // The web back office: the font is loaded once for the page, and the two name classes use it.
      ...(read("apps/admin/src/app/layout.tsx").includes("Space_Grotesk")
        ? []
        : ["layout loads it"]),
      ...[".brand", ".mnav-brand"].filter((sel) => !usesBrandFont(sel)),
      // The phone app: each screen that shows the name asks for the font.
      ...["apps/mobile/src/ui/Shell.tsx", "apps/mobile/src/app/sign-in.tsx"].filter(
        (f) => !read(f).includes("useBrandFont("),
      ),
    ];
    expect(misses).toEqual([]);
  });
});

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

/** The bodies of every CSS rule whose selector list names `selector`, nested ones included. */
function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel!.split(",").some((s) => s.trim() === selector))
    .map(([, , body]) => body!);
}
