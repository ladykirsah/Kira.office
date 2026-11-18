import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PREF, PREF_RENAMES, movePrefs, type PrefStore } from "./prefNames";

// Plan 9.2 leftovers (owner, 18 Nov 2026: "Go"): what the app keeps on a phone or in a browser moves
// from its old kira_ names to teampit_ names on the first open of the new version — and nothing it
// held is lost on the way: not the sign-in, not the settings, never a bill that has not been sent.

function memoryStore(start: Record<string, string> = {}, failSet: string[] = []) {
  const data = new Map(Object.entries(start));
  const store: PrefStore = {
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      if (failSet.includes(k)) throw new Error("storage full");
      data.set(k, v);
    },
    remove: async (k) => {
      data.delete(k);
    },
  };
  return { store, data };
}

const bill = (uuid: string, label: string) => ({
  sale: { clientUuid: uuid },
  issuedAt: 1,
  totalSatang: 100,
  label,
  status: "waiting",
  reason: null,
});

describe("movePrefs", () => {
  it("given a value under an old name only > then it is under the new name and the old name is gone", async () => {
    const { store, data } = memoryStore({ kira_lang: "en", kira_theme: "dark" });
    await movePrefs(store);
    expect(data.get(PREF.lang)).toBe("en");
    expect(data.get(PREF.theme)).toBe("dark");
    expect(data.has("kira_lang")).toBe(false);
    expect(data.has("kira_theme")).toBe(false);
  });

  it("given a bill that was never sent > then it is still waiting after the move", async () => {
    const queue = JSON.stringify([bill("u-1", "กข 1234")]);
    const { store, data } = memoryStore({ kira_pos_queue: queue });
    await movePrefs(store);
    expect(JSON.parse(data.get(PREF.posQueue) ?? "[]")).toEqual([bill("u-1", "กข 1234")]);
    expect(data.has("kira_pos_queue")).toBe(false);
  });

  it("given waiting bills under both names (an old tab still open) > then every bill is kept once", async () => {
    const { store, data } = memoryStore({
      kira_pos_queue: JSON.stringify([bill("u-1", "old copy"), bill("u-2", "only in old")]),
      teampit_pos_queue: JSON.stringify([bill("u-1", "new copy"), bill("u-3", "only in new")]),
    });
    await movePrefs(store);
    const kept = JSON.parse(data.get(PREF.posQueue) ?? "[]") as ReturnType<typeof bill>[];
    expect(kept.map((b) => b.sale.clientUuid).sort()).toEqual(["u-1", "u-2", "u-3"]);
    expect(kept.find((b) => b.sale.clientUuid === "u-1")?.label).toBe("new copy");
    expect(data.has("kira_pos_queue")).toBe(false);
  });

  it("given a setting under both names > then the new one wins and the old one is cleared", async () => {
    const { store, data } = memoryStore({ kira_theme: "dark", teampit_theme: "light" });
    await movePrefs(store);
    expect(data.get(PREF.theme)).toBe("light");
    expect(data.has("kira_theme")).toBe(false);
  });

  it("given the new name cannot be saved > then the old value is kept, not lost", async () => {
    const queue = JSON.stringify([bill("u-9", "keep me")]);
    const { store, data } = memoryStore({ kira_pos_queue: queue }, [PREF.posQueue]);
    await expect(movePrefs(store)).resolves.toBeDefined();
    expect(data.get("kira_pos_queue")).toBe(queue);
  });

  it("given nothing saved yet > then nothing is written", async () => {
    const { store, data } = memoryStore();
    expect(await movePrefs(store)).toEqual([]);
    expect(data.size).toBe(0);
  });

  it("given the sign-in on a phone > then it moves too, so nobody has to sign in again", async () => {
    const { store, data } = memoryStore({ kira_staff: "tok-123" });
    await movePrefs(store);
    expect(data.get(PREF.staff)).toBe("tok-123");
  });
});

describe("the app's saved names", () => {
  it("given every rename > then each old kira_ name has one teampit_ name", () => {
    expect(PREF_RENAMES.length).toBe(10);
    for (const [from, to] of PREF_RENAMES) {
      expect(from).toMatch(/^kira_/);
      expect(to).toBe(from.replace(/^kira_/, "teampit_"));
    }
  });

  it("given the app's code > then no screen reads or writes an old kira_ name any more", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), "..");
    const left: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (
          /\.(ts|tsx)$/.test(name) &&
          !/\.test\./.test(name) &&
          !path.endsWith("prefNames.ts")
        ) {
          if (/["'`]kira_/.test(readFileSync(path, "utf8"))) left.push(path.slice(src.length + 1));
        }
      }
    };
    walk(src);
    expect(left).toEqual([]);
  });
});
