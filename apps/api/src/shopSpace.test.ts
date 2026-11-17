import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker, { StockLedger, type Env } from "./index";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

// Plan 10.3 (owner 17 Nov 2026, pick A): two shops on one server, each in its own database. The
// app's address says which shop; nothing made in one may show, change or be signed into from the
// other. Den Air is the shop that was always here; "practice2" is a second shop. Real schema.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

const DEN_AIR_APP = "https://admin.airplusauto.com";
const SHOP2_APP = "http://localhost:8082";

function realDb() {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    raw.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  raw.exec("PRAGMA foreign_keys = ON");
  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async all<T>() {
          return { results: raw.prepare(sql).all(...(binds as never[])) as T[] };
        },
        async first<T>(col?: string) {
          const row = raw.prepare(sql).get(...(binds as never[])) as
            Record<string, unknown> | undefined;
          if (!row) return null;
          return (col ? row[col] : row) as T;
        },
        async run() {
          const out = raw.prepare(sql).run(...(binds as never[]));
          return { success: true, meta: { changes: Number(out.changes) } };
        },
        __exec() {
          return raw.prepare(sql).run(...(binds as never[]));
        },
      };
      return stmt;
    },
    async batch(stmts: { __exec: () => unknown }[]) {
      raw.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.__exec());
        raw.exec("COMMIT");
        return out;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
  } as unknown as D1Database;
  return { raw, db };
}

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

function twoShops() {
  const den = realDb();
  const two = realDb();
  const { store: kvStore, kv } = memoryKv();
  const bucket = new Map<string, string>();
  const IMAGES = {
    async put(key: string, value: string) {
      bucket.set(key, value);
    },
    async get() {
      return null;
    },
  } as unknown as R2Bucket;
  const env = {
    DB: den.db,
    DB_PRACTICE2: two.db,
    KV: kv,
    IMAGES,
    PRACTICE_COPY: "1",
    SUPER_ADMIN_EMAILS: "owner@practice.local",
    SHOPS: JSON.stringify([
      { id: "practice2", name: "ร้านทดลอง 2", db: "DB_PRACTICE2", origins: [SHOP2_APP] },
    ]),
  } as unknown as Env & { DB_PRACTICE2: D1Database };
  // The stock writer, the way Cloudflare runs it: one object per name, given the Worker's whole
  // settings — it must find its own shop from the name it was opened with.
  const objects = new Map<string, StockLedger>();
  (env as { STOCK_LEDGER: unknown }).STOCK_LEDGER = {
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => {
      let object = objects.get(id.name);
      if (!object) {
        const ctx = { id, blockConcurrencyWhile: (fn: () => unknown) => fn(), storage: {} };
        object = new StockLedger(ctx as never, env as never);
        objects.set(id.name, object);
      }
      return object;
    },
  };
  return { env, den, two, kvStore, bucket, objects };
}

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

function call(env: Env, origin: string | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (origin) headers.set("Origin", origin);
  if (init.body) headers.set("content-type", "application/json");
  return worker.fetch!(new Request(`https://api.test${path}`, { ...init, headers }), env, ctx);
}

async function signIn(env: Env, origin: string | null): Promise<string> {
  const res = await call(env, origin, "/staff/login-practice", { method: "POST" });
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

const as = (token: string) => ({ "X-Staff-Session": token });

describe("two shops > a sign-in belongs to its own shop", () => {
  it("given a Den Air sign-in used at the second shop's address > then refused, and the other way too", async () => {
    const { env } = twoShops();
    const den = await signIn(env, DEN_AIR_APP);
    const two = await signIn(env, SHOP2_APP);
    expect((await call(env, SHOP2_APP, "/services", { headers: as(den) })).status).toBe(401);
    expect((await call(env, DEN_AIR_APP, "/services", { headers: as(two) })).status).toBe(401);
    expect((await call(env, SHOP2_APP, "/services", { headers: as(two) })).status).toBe(200);
  });

  it("given no address or one nobody claims > then Den Air, as today", async () => {
    const { env } = twoShops();
    const den = await signIn(env, DEN_AIR_APP);
    expect((await call(env, null, "/services", { headers: as(den) })).status).toBe(200);
    expect(
      (await call(env, "https://elsewhere.test", "/services", { headers: as(den) })).status,
    ).toBe(200);
  });
});

describe("two shops > the 6-wrong-PIN brake is per shop", () => {
  it("given 6 wrong PINs at the second shop > then its PIN sign-in pauses, Den Air's does not", async () => {
    const { env } = twoShops();
    const pinEnv = { ...env, STAFF_PIN_PEPPER: "pepper" } as Env;
    let n = 0;
    const tryPin = (origin: string) =>
      call(pinEnv, origin, "/staff/login-pin", {
        method: "POST",
        // A new address each try, so only the shop-wide brake can stop it.
        headers: { "cf-connecting-ip": `10.0.0.${++n}` },
        body: JSON.stringify({ pin: "000000" }),
      });
    for (let i = 0; i < 6; i++) expect((await tryPin(SHOP2_APP)).status).toBe(401);
    expect((await tryPin(SHOP2_APP)).status).not.toBe(401);
    expect((await tryPin(DEN_AIR_APP)).status).toBe(401);
  });
});

describe("two shops > records stay in their own shop", () => {
  it("given a service added at the second shop > then only the second shop has it", async () => {
    const { env, den, two } = twoShops();
    const twoToken = await signIn(env, SHOP2_APP);
    const denToken = await signIn(env, DEN_AIR_APP);
    const added = await call(env, SHOP2_APP, "/services", {
      method: "POST",
      headers: as(twoToken),
      body: JSON.stringify({ name: "ล้างแอร์ร้าน 2", basePriceSatang: 50000 }),
    });
    expect(added.status).toBe(201);

    const names = (raw: DatabaseSync) =>
      (raw.prepare("SELECT name FROM services").all() as { name: string }[]).map((r) => r.name);
    expect(names(two.raw)).toContain("ล้างแอร์ร้าน 2");
    expect(names(den.raw)).not.toContain("ล้างแอร์ร้าน 2");
    const denList = (await (
      await call(env, DEN_AIR_APP, "/services", { headers: as(denToken) })
    ).json()) as { services: { name: string }[] };
    expect(denList.services.map((s) => s.name)).not.toContain("ล้างแอร์ร้าน 2");
  });

  it("given a repair job opened at each shop > then each lands in its own shop with its own first number", async () => {
    const { env, den, two, objects } = twoShops();
    const twoToken = await signIn(env, SHOP2_APP);
    const denToken = await signIn(env, DEN_AIR_APP);
    const open = (origin: string, token: string) =>
      call(env, origin, "/repair-jobs", {
        method: "POST",
        headers: as(token),
        body: JSON.stringify({ licensePlate: "1กก 1234", problem: "แอร์ไม่เย็น" }),
      });
    const a = (await (await open(SHOP2_APP, twoToken)).json()) as { job: { jobNumber: string } };
    const b = (await (await open(DEN_AIR_APP, denToken)).json()) as { job: { jobNumber: string } };

    const count = (raw: DatabaseSync) =>
      (raw.prepare("SELECT COUNT(*) AS n FROM repair_jobs").get() as { n: number }).n;
    expect(count(two.raw)).toBe(1);
    expect(count(den.raw)).toBe(1);
    expect(a.job.jobNumber).toBe(b.job.jobNumber);
    // Each shop's stock writer is its own; Den Air's keeps the name the AirPlus website calls.
    expect([...objects.keys()].sort()).toEqual(["default", "shop:practice2"]);
  });
});

describe("two shops > settings stay in their own shop", () => {
  it("given ข้อมูลร้าน saved at the second shop > then Den Air's stays as it was", async () => {
    const { env, kvStore } = twoShops();
    kvStore.set("shop:denair:name", "Den Air Service");
    const twoToken = await signIn(env, SHOP2_APP);
    const saved = await call(env, SHOP2_APP, "/shop-info/denair", {
      method: "PUT",
      headers: as(twoToken),
      body: JSON.stringify({ name: "ร้านแอร์ทดลอง" }),
    });
    expect(saved.status).toBe(200);
    expect(kvStore.get("shop:denair:name")).toBe("Den Air Service");
    expect(kvStore.get("shops/practice2/shop:denair:name")).toBe("ร้านแอร์ทดลอง");
  });

  it("given the second shop > then it has its counter card only, no AirPlus card", async () => {
    const { env } = twoShops();
    const twoToken = await signIn(env, SHOP2_APP);
    expect(
      (await call(env, SHOP2_APP, "/shop-info/airplus", { headers: as(twoToken) })).status,
    ).toBe(404);
    const shop = (await (
      await call(env, SHOP2_APP, "/shop", { headers: as(twoToken) })
    ).json()) as {
      id: string;
      name: string;
      profiles: string[];
    };
    expect(shop).toEqual({ id: "practice2", name: "ร้านทดลอง 2", profiles: ["denair"] });
  });

  it("given Den Air > then both its cards, as today", async () => {
    const { env } = twoShops();
    const denToken = await signIn(env, DEN_AIR_APP);
    const shop = (await (
      await call(env, DEN_AIR_APP, "/shop", { headers: as(denToken) })
    ).json()) as {
      profiles: string[];
    };
    expect(shop.profiles).toEqual(["denair", "airplus"]);
  });
});

describe("two shops > the sign-in page names the shop (plan 9.2, design A)", () => {
  it("given Den Air's address > then Den Air Service + AirPlus, before anyone signs in", async () => {
    const { env } = twoShops();
    const res = await call(env, DEN_AIR_APP, "/sign-in-shop");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ line: "Den Air Service + AirPlus" });
  });

  it("given another shop's address > then its own name, never AirPlus", async () => {
    const { env } = twoShops();
    const res = await call(env, SHOP2_APP, "/sign-in-shop");
    expect(await res.json()).toEqual({ line: "ร้านทดลอง 2" });
  });
});

describe("two shops > a shop whose database isn't connected", () => {
  it("given its address > then a plain refusal, nothing read or written", async () => {
    const { env } = twoShops();
    const off = { ...env, DB_PRACTICE2: undefined } as unknown as Env;
    expect((await call(off, SHOP2_APP, "/staff/login-practice", { method: "POST" })).status).toBe(
      503,
    );
  });
});

describe("two shops > the daily jobs run for every shop", () => {
  it("given the nightly run > then each shop gets its own backup of its own records", async () => {
    const { env, bucket, two } = twoShops();
    two.raw.exec(
      "INSERT INTO services (id, name, base_price_satang, created_at) VALUES ('sv-2', 'บริการร้าน 2', 0, 0)",
    );
    const at = Date.UTC(2026, 10, 17, 19, 0);
    await worker.scheduled!({ scheduledTime: at, cron: "0 19 * * *" } as never, env, ctx);
    expect([...bucket.keys()].sort()).toEqual([
      "backups/2026-11-17.json",
      "shops/practice2/backups/2026-11-17.json",
    ]);
    const twoBackup = JSON.parse(bucket.get("shops/practice2/backups/2026-11-17.json")!) as {
      tables: { services: { name: string }[] };
    };
    const denBackup = JSON.parse(bucket.get("backups/2026-11-17.json")!) as {
      tables: { services: { name: string }[] };
    };
    expect(twoBackup.tables.services.map((s) => s.name)).toContain("บริการร้าน 2");
    expect(denBackup.tables.services.map((s) => s.name)).not.toContain("บริการร้าน 2");
  });
});
