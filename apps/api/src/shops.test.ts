import { describe, expect, it } from "vitest";
import { DEN_AIR, prefixKv, readShops, shopEnv, shopForLedger, shopForOrigin } from "./shops";

// Plan 10.3 (owner 17 Nov 2026, pick A): each shop has its own space — its own database, its own
// settings, its own stock writer — and the app's web address says which shop it is. Den Air is the
// shop that was always here: its database, settings keys and stock writer stay exactly where they are.

const PRACTICE2 = {
  id: "practice2",
  name: "ร้านทดลอง 2",
  db: "DB_PRACTICE2",
  origins: ["http://localhost:8082"],
  ownerEmails: "owner2@practice.local",
};
const CONFIG = JSON.stringify([PRACTICE2]);

describe("readShops > the shop list", () => {
  it("given no extra shops > then Den Air alone, as today", () => {
    expect(readShops(undefined)).toEqual([DEN_AIR]);
    expect(readShops("")).toEqual([DEN_AIR]);
  });

  it("given Den Air > then its database, stock writer, settings and cards stay where they were", () => {
    expect(DEN_AIR).toMatchObject({
      id: "denair",
      db: "DB",
      ledger: "default",
      prefix: "",
      profiles: ["denair", "airplus"],
    });
  });

  it("given another shop > then its own database, stock writer, settings prefix and one counter card", () => {
    const [, two] = readShops(CONFIG);
    expect(two).toEqual({
      id: "practice2",
      name: "ร้านทดลอง 2",
      db: "DB_PRACTICE2",
      ledger: "shop:practice2",
      prefix: "shops/practice2/",
      profiles: ["denair"],
      origins: ["http://localhost:8082"],
      ownerEmails: "owner2@practice.local",
    });
  });

  it("given a broken entry > then it is left out and Den Air still works", () => {
    const bad = JSON.stringify([
      { ...PRACTICE2, id: "denair" }, // can't take Den Air's place
      { ...PRACTICE2, id: "Bad Id" },
      { ...PRACTICE2, id: "x2", db: "DB" }, // can't share Den Air's database
      { ...PRACTICE2, id: "x3", db: "lowercase" },
      { ...PRACTICE2, id: "x4", origins: ["ftp://nope"] },
      { ...PRACTICE2, id: "x5", origins: [] },
    ]);
    expect(readShops(bad)).toEqual([DEN_AIR]);
    expect(readShops("not json")).toEqual([DEN_AIR]);
    expect(readShops('{"id":"x"}')).toEqual([DEN_AIR]);
  });

  it("given two shops claiming one address or one database > then only the first keeps it", () => {
    const twice = JSON.stringify([PRACTICE2, { ...PRACTICE2, id: "practice3" }]);
    expect(readShops(twice).map((s) => s.id)).toEqual(["denair", "practice2"]);
  });
});

describe("shopForOrigin > the app's address picks the shop", () => {
  const shops = readShops(CONFIG);

  it("given the second shop's address > then that shop", () => {
    expect(shopForOrigin(shops, "http://localhost:8082").id).toBe("practice2");
  });

  it("given Den Air's address, any other address or none > then Den Air, as today", () => {
    expect(shopForOrigin(shops, "https://admin.airplusauto.com").id).toBe("denair");
    expect(shopForOrigin(shops, "https://evil.example").id).toBe("denair");
    expect(shopForOrigin(shops, null).id).toBe("denair");
  });
});

describe("shopForLedger > the stock writer knows its shop by its name", () => {
  const shops = readShops(CONFIG);

  it("given Den Air's old name or no name > then Den Air", () => {
    expect(shopForLedger(shops, "default")?.id).toBe("denair");
    expect(shopForLedger(shops, undefined)?.id).toBe("denair");
  });

  it("given another shop's name > then that shop; an unknown name > then none", () => {
    expect(shopForLedger(shops, "shop:practice2")?.id).toBe("practice2");
    expect(shopForLedger(shops, "shop:gone")).toBeNull();
  });
});

function memoryKv() {
  const store = new Map<string, string>();
  const kv = {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(opts: { prefix?: string } = {}) {
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(opts.prefix ?? ""))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  } as unknown as KVNamespace;
  return { store, kv };
}

describe("prefixKv > another shop's settings sit under its own prefix", () => {
  it("given a put, get, delete and list > then each works on the shop's own keys only", async () => {
    const { store, kv } = memoryKv();
    await kv.put("shop:denair:name", "Den Air Service");
    const two = prefixKv(kv, "shops/practice2/");
    await two.put("shop:denair:name", "ร้านทดลอง 2");

    expect(store.get("shop:denair:name")).toBe("Den Air Service");
    expect(store.get("shops/practice2/shop:denair:name")).toBe("ร้านทดลอง 2");
    expect(await two.get("shop:denair:name")).toBe("ร้านทดลอง 2");
    const listed = await two.list({ prefix: "shop:" });
    expect(listed.keys.map((k) => k.name)).toEqual(["shop:denair:name"]);
    await two.delete("shop:denair:name");
    expect(store.has("shops/practice2/shop:denair:name")).toBe(false);
    expect(store.get("shop:denair:name")).toBe("Den Air Service");
  });

  it("given Den Air's empty prefix > then the same settings store, untouched", () => {
    const { kv } = memoryKv();
    expect(prefixKv(kv, "")).toBe(kv);
  });
});

describe("shopEnv > everything a request touches, for one shop", () => {
  const denDb = { name: "den" } as unknown as D1Database;
  const twoDb = { name: "two" } as unknown as D1Database;
  const { kv } = memoryKv();
  const base = {
    DB: denDb,
    DB_PRACTICE2: twoDb,
    KV: kv,
    SUPER_ADMIN_EMAILS: "owner@denair.test",
    SHOPS: CONFIG,
  };
  const shops = readShops(CONFIG);

  it("given Den Air > then its own database, settings and owner emails, unchanged", () => {
    const env = shopEnv(base, DEN_AIR);
    expect(env?.DB).toBe(denDb);
    expect(env?.KV).toBe(kv);
    expect(env?.SUPER_ADMIN_EMAILS).toBe("owner@denair.test");
    expect(env?.SHOP).toBe(DEN_AIR);
  });

  it("given the second shop > then its database, its prefixed settings and its own owner", () => {
    const env = shopEnv(base, shops[1]!);
    expect(env?.DB).toBe(twoDb);
    expect(env?.KV).not.toBe(kv);
    expect(env?.SUPER_ADMIN_EMAILS).toBe("owner2@practice.local");
    expect(env?.SHOP?.id).toBe("practice2");
  });

  it("given a shop whose database is not connected here > then none", () => {
    expect(shopEnv({ ...base, DB_PRACTICE2: undefined }, shops[1]!)).toBeNull();
  });
});
