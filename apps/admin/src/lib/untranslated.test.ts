import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findUntranslated, isUserFacing } from "./untranslated";

describe("isUserFacing", () => {
  it("counts a phrase a person reads", () => {
    expect(isUserFacing("Save the refund")).toBe(true);
    expect(isUserFacing("เตรียมจัดส่ง")).toBe(true);
  });

  it("ignores what a machine matches, not a person", () => {
    expect(isUserFacing("btn-primary")).toBe(false);
    expect(isUserFacing("/orders/new")).toBe(false);
    expect(isUserFacing("PENDING")).toBe(false);
    expect(isUserFacing("var(--text)")).toBe(false);
  });

  /** A name is not a word. Translating "AirPlus" would be wrong, not merely unnecessary. */
  it("ignores the names of shops and channels", () => {
    expect(isUserFacing("AirPlus")).toBe(false);
    expect(isUserFacing("Shopee")).toBe(false);
    expect(isUserFacing("Den Air Service")).toBe(false);
  });
});

describe("findUntranslated", () => {
  it("finds a heading, an attribute and a bare Thai string", () => {
    const src = `
      <h2>Payments</h2>
      <input placeholder="Search here" />
      <span>{t({ th: "วันหยุด", en: "Days off" })}</span>
      const msg = "บันทึกแล้ว";
    `;
    const found = findUntranslated(src).map((f) => f.text);
    expect(found).toContain("Payments");
    expect(found).toContain('placeholder="Search here"');
    expect(found).toContain("bare Thai: บันทึกแล้ว");
  });

  it("says nothing about text already inside t({ th, en })", () => {
    const src = `<h2>{t({ th: "รายการจ่ายเงิน", en: "Payments" })}</h2>`;
    expect(findUntranslated(src)).toEqual([]);
  });

  it("ignores comments, which are for us and not for the screen", () => {
    expect(findUntranslated(`// Save the order first\n/* Then Publish it */`)).toEqual([]);
  });
});

/**
 * THE SCREENS THAT ARE DONE STAY DONE (owner, 2026-08-25: "re-check on every spot").
 *
 * The rest of the admin is still being worked through, so this guards only the folders that have
 * been finished. Add a folder here the moment its sweep is complete — that is what stops the next
 * screen from quietly undoing this one.
 */
const CLEARED = [
  "app/products",
  "app/orders",
  "app/nav.ts",
  "app/Sidebar.tsx",
  "app/MobileNav.tsx",
  "app/AppShell.tsx",
  "app/StaffChip.tsx",
  "app/ThemeToggle.tsx",
  "app/LanguageToggle.tsx",
  "app/Modal.tsx",
  "app/page.tsx",
];

/**
 * Resolved from THIS FILE, not from `process.cwd()`. Vitest runs from the repo root, so a
 * cwd-relative path pointed at a directory that does not exist, the scan found no files, and every
 * folder below passed while checking nothing. A test that cannot fail is worse than no test.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Text that is deliberately ONE language, with the reason. Not a to-do list — each of these would be
 * a bug if it were translated.
 */
const DELIBERATE: Record<string, string> = {
  // The sticker that goes on the parcel. It is read by a Thai courier and a Thai recipient; which
  // language the person at the screen is reading has nothing to do with it.
  "app/orders/[id]/ShipmentActions.tsx": "the printed shipping label",
  // The button that offers Thai says so IN Thai, exactly as the English side says "Switch to
  // English" in English. A label naming a language must be written in that language.
  "app/LanguageToggle.tsx": "each label names its own language",
};

function filesUnder(rel: string): string[] {
  const abs = join(SRC, rel);
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesUnder(join(rel, e.name))
      : /\.tsx?$/.test(e.name) && !e.name.includes(".test.")
        ? [join(abs, e.name)]
        : [],
  );
}

describe("the finished screens say everything in both languages", () => {
  // The guard against the bug this suite already had once: if the scan reads nothing, every
  // assertion below is vacuously true and the suite is decoration.
  it("every deliberate exception names a file that exists", () => {
    // An exception for a file that has been renamed away would silently stop guarding anything.
    const all = new Set(CLEARED.flatMap(filesUnder).map((f) => f.split("/src/")[1]!));
    expect(Object.keys(DELIBERATE).filter((k) => !all.has(k))).toEqual([]);
  });

  it("actually reads the source files", () => {
    const count = CLEARED.flatMap(filesUnder).length;
    expect(count).toBeGreaterThan(30);
  });

  for (const rel of CLEARED) {
    it(`${rel} has no untranslated text left`, () => {
      const misses = filesUnder(rel)
        .filter((f) => !(f.split("/src/")[1]! in DELIBERATE))
        .flatMap((f) =>
          findUntranslated(readFileSync(f, "utf8")).map(
            (m) => `${f.split("/src/")[1]}:${m.line}: ${m.text}`,
          ),
        );
      expect(misses).toEqual([]);
    });
  }
});
