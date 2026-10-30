import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  applySyncToDb,
  saveDraftToDb,
  listOpenDrafts,
  getOnsiteSale,
  getCustomerDetail,
} from "./index";

// `cloudflare:workers` is a Workers-runtime virtual module that doesn't exist under Node/vitest.
// Stub its DurableObject base so importing the Worker (which extends it) works in tests.
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

// ── The ทำบิล page's two bill facts: the car's mileage and a mechanic buyer's name (2026-10-30) ──
// Run against a real SQLite built from the real migrations, so the new columns are proven to exist
// and to round-trip — a canned-row mock could not see a missing column.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return db;
}

/** prepare → bind → all/first/run, plus an atomic batch (the sync and draft paths rely on it). */
function asD1(db: DatabaseSync): D1Database {
  const make = (sql: string) => {
    let binds: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        binds = args;
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: db.prepare(sql).all(...(binds as never[])) as T[] };
      },
      async first<T = unknown>(): Promise<T | null> {
        return (db.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
      },
      async run() {
        return db.prepare(sql).run(...(binds as never[]));
      },
      __exec() {
        return db.prepare(sql).run(...(binds as never[]));
      },
    };
    return stmt;
  };
  return {
    prepare: (sql: string) => make(sql),
    async batch(stmts: { __exec: () => unknown }[]) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.__exec());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
}

function fresh() {
  const raw = migratedDb();
  return { raw, db: asD1(raw) };
}

/** A labour-only line: no product, so no stock to seed. */
const SERVICE_LINE = { lineType: "service" as const, quantity: 1, unitPriceSatang: 50000 };

const storedBill = (raw: DatabaseSync, clientUuid: string) =>
  raw
    .prepare(
      `SELECT mileage_km AS mileageKm, buyer_name AS buyerName
         FROM onsite_sales WHERE client_uuid = ?`,
    )
    .get(clientUuid) as { mileageKm: number | null; buyerName: string | null } | undefined;

describe("applySyncToDb > mileage and buyer name", () => {
  it("given a bill with mileageKm and buyerName > stores both on the bill row", async () => {
    const { raw, db } = fresh();
    const out = await applySyncToDb(db, [
      { clientUuid: "b-1", mileageKm: 123456, buyerName: "ช่างเอก", lines: [SERVICE_LINE] },
    ]);
    expect(out.applied).toBe(1);
    expect(storedBill(raw, "b-1")).toEqual({ mileageKm: 123456, buyerName: "ช่างเอก" });
  });

  it.each([
    ["a fraction", 12.5],
    ["a negative", -1],
    ["more than 9,999,999", 10_000_000],
    ["text", "12345"],
  ])("given a mileage that is %s > refuses the bill with a plain reason", async (_, km) => {
    const { raw, db } = fresh();
    const out = await applySyncToDb(db, [
      { clientUuid: "bad-km", mileageKm: km as number, lines: [SERVICE_LINE] },
    ]);
    expect(out.applied).toBe(0);
    expect(out.validationErrors).toEqual([
      { clientUuid: "bad-km", reason: "mileage must be a whole number of km, 0 to 9,999,999" },
    ]);
    expect(storedBill(raw, "bad-km")).toBeUndefined();
  });

  it("given a buyer name with spaces around it > stores it trimmed", async () => {
    const { raw, db } = fresh();
    await applySyncToDb(db, [
      { clientUuid: "b-2", buyerName: "  ช่างเอก  ", lines: [SERVICE_LINE] },
    ]);
    expect(storedBill(raw, "b-2")?.buyerName).toBe("ช่างเอก");
  });

  it("given a blank buyer name > stores no name", async () => {
    const { raw, db } = fresh();
    await applySyncToDb(db, [{ clientUuid: "b-3", buyerName: "   ", lines: [SERVICE_LINE] }]);
    expect(storedBill(raw, "b-3")?.buyerName).toBeNull();
  });

  it("given a buyer name longer than 80 characters > refuses the bill with a plain reason", async () => {
    const { raw, db } = fresh();
    const out = await applySyncToDb(db, [
      { clientUuid: "long-name", buyerName: "ก".repeat(81), lines: [SERVICE_LINE] },
    ]);
    expect(out.applied).toBe(0);
    expect(out.validationErrors).toEqual([
      { clientUuid: "long-name", reason: "buyer name must be 80 characters or fewer" },
    ]);
    expect(storedBill(raw, "long-name")).toBeUndefined();
  });

  it("given a buyer name that is not text > refuses the bill with a plain reason", async () => {
    const { db } = fresh();
    const out = await applySyncToDb(db, [
      { clientUuid: "num-name", buyerName: 42 as unknown as string, lines: [SERVICE_LINE] },
    ]);
    expect(out.validationErrors).toEqual([
      { clientUuid: "num-name", reason: "buyer name must be text" },
    ]);
  });

  it("given no mileage and no buyer > stores neither (an older device's bill is unchanged)", async () => {
    const { raw, db } = fresh();
    await applySyncToDb(db, [{ clientUuid: "old-1", lines: [SERVICE_LINE] }]);
    expect(storedBill(raw, "old-1")).toEqual({ mileageKm: null, buyerName: null });
  });

  it("given the same bill sent twice > it is stored once, with the first send's mileage", async () => {
    const { raw, db } = fresh();
    await applySyncToDb(db, [{ clientUuid: "dup-1", mileageKm: 1000, lines: [SERVICE_LINE] }]);
    const again = await applySyncToDb(db, [
      { clientUuid: "dup-1", mileageKm: 2000, lines: [SERVICE_LINE] },
    ]);
    expect(again).toMatchObject({ applied: 0, duplicates: 1 });
    expect(storedBill(raw, "dup-1")?.mileageKm).toBe(1000);
  });
});

const storedById = (raw: DatabaseSync, id: string) =>
  raw
    .prepare(
      `SELECT mileage_km AS mileageKm, buyer_name AS buyerName FROM onsite_sales WHERE id = ?`,
    )
    .get(id) as { mileageKm: number | null; buyerName: string | null } | undefined;

describe("saveDraftToDb > mileage and buyer name", () => {
  it("given a draft with mileageKm and buyerName > stores both, tidied", async () => {
    const { raw, db } = fresh();
    const out = await saveDraftToDb(db, {
      draftId: "d-1",
      stage: "draft",
      mileageKm: 98765,
      buyerName: "  ช่างโต้ง ",
      lines: [SERVICE_LINE],
    });
    expect(out.ok).toBe(true);
    expect(storedById(raw, "d-1")).toEqual({ mileageKm: 98765, buyerName: "ช่างโต้ง" });
  });

  it("given a resave that clears them > the draft keeps no mileage and no buyer", async () => {
    const { raw, db } = fresh();
    await saveDraftToDb(db, {
      draftId: "d-2",
      stage: "quotation",
      mileageKm: 5000,
      buyerName: "ช่างโต้ง",
      lines: [SERVICE_LINE],
    });
    await saveDraftToDb(db, {
      draftId: "d-2",
      stage: "quotation",
      mileageKm: null,
      buyerName: "",
      lines: [SERVICE_LINE],
    });
    expect(storedById(raw, "d-2")).toEqual({ mileageKm: null, buyerName: null });
  });

  it("given a bad mileage > refuses with a plain reason and stores nothing", async () => {
    const { raw, db } = fresh();
    const out = await saveDraftToDb(db, {
      draftId: "d-3",
      stage: "draft",
      mileageKm: -5,
      lines: [SERVICE_LINE],
    });
    expect(out).toEqual({
      ok: false,
      error: "mileage must be a whole number of km, 0 to 9,999,999",
    });
    expect(storedById(raw, "d-3")).toBeUndefined();
  });

  it("given a buyer name longer than 80 characters > refuses with a plain reason", async () => {
    const { raw, db } = fresh();
    const out = await saveDraftToDb(db, {
      draftId: "d-4",
      stage: "draft",
      buyerName: "x".repeat(81),
      lines: [SERVICE_LINE],
    });
    expect(out).toEqual({ ok: false, error: "buyer name must be 80 characters or fewer" });
    expect(storedById(raw, "d-4")).toBeUndefined();
  });

  it("given a finalized bill's id > still refuses, and the bill keeps its mileage", async () => {
    const { raw, db } = fresh();
    await applySyncToDb(db, [{ clientUuid: "bill-1", mileageKm: 4321, lines: [SERVICE_LINE] }]);
    const billId = (
      raw.prepare(`SELECT id FROM onsite_sales WHERE client_uuid = 'bill-1'`).get() as {
        id: string;
      }
    ).id;
    const out = await saveDraftToDb(db, {
      draftId: billId,
      stage: "draft",
      mileageKm: 1,
      lines: [SERVICE_LINE],
    });
    expect(out).toEqual({ ok: false, error: "cannot save a draft over a finalized bill" });
    expect(storedById(raw, billId)?.mileageKm).toBe(4321);
  });
});

const idOf = (raw: DatabaseSync, clientUuid: string) =>
  (
    raw.prepare(`SELECT id FROM onsite_sales WHERE client_uuid = ?`).get(clientUuid) as {
      id: string;
    }
  ).id;

describe("reading mileage and buyer name back", () => {
  it("GET /onsite/drafts > each open draft carries its mileageKm and buyerName", async () => {
    const { db } = fresh();
    await saveDraftToDb(db, {
      draftId: "d-r",
      stage: "quotation",
      mileageKm: 777,
      buyerName: "ช่างเอก",
      lines: [SERVICE_LINE],
    });
    const [draft] = (await listOpenDrafts(db)) as Record<string, unknown>[];
    expect(draft).toMatchObject({ id: "d-r", mileageKm: 777, buyerName: "ช่างเอก" });
  });

  it("GET /onsite/sales/:id > the bill carries its mileageKm and buyerName", async () => {
    const { raw, db } = fresh();
    await applySyncToDb(db, [
      { clientUuid: "s-r", mileageKm: 888, buyerName: "ช่างโต้ง", lines: [SERVICE_LINE] },
    ]);
    const sale = (await getOnsiteSale(db, idOf(raw, "s-r"))) as Record<string, unknown>;
    expect(sale).toMatchObject({ mileageKm: 888, buyerName: "ช่างโต้ง" });
  });
});

const PLATE = "1กข 1234";

type CustomerDetail = {
  history: Record<string, unknown>[];
  quotations: Record<string, unknown>[];
  lastMileage: { km: number; at: number } | null;
};

/** Sync a plated bill and pin its created_at, so "newest" is deterministic. */
async function billAt(
  raw: DatabaseSync,
  db: D1Database,
  clientUuid: string,
  at: number,
  extras: { mileageKm?: number | null; buyerName?: string | null } = {},
) {
  await applySyncToDb(db, [{ clientUuid, licensePlate: PLATE, ...extras, lines: [SERVICE_LINE] }]);
  raw.prepare(`UPDATE onsite_sales SET created_at = ? WHERE client_uuid = ?`).run(at, clientUuid);
}

describe("getCustomerDetail > mileage and buyer name", () => {
  it("given a bill and a quotation > each row carries its mileageKm and buyerName", async () => {
    const { raw, db } = fresh();
    await billAt(raw, db, "c-bill", 1_000, { mileageKm: 50_000, buyerName: "ช่างเอก" });
    await saveDraftToDb(db, {
      draftId: "c-quote",
      stage: "quotation",
      licensePlate: PLATE,
      mileageKm: 51_000,
      lines: [SERVICE_LINE],
    });
    const detail = (await getCustomerDetail(db, PLATE)) as CustomerDetail;
    expect(detail.history[0]).toMatchObject({ mileageKm: 50_000, buyerName: "ช่างเอก" });
    expect(detail.quotations[0]).toMatchObject({ mileageKm: 51_000, buyerName: null });
  });

  it("lastMileage > is the newest bill that recorded one, skipping later bills and quotations without it", async () => {
    const { raw, db } = fresh();
    await billAt(raw, db, "m-old", 1_000, { mileageKm: 40_000 });
    await billAt(raw, db, "m-new", 2_000, { mileageKm: 45_000 });
    await billAt(raw, db, "m-none", 3_000); // a later bill with no reading
    await saveDraftToDb(db, {
      draftId: "m-quote", // a quotation is not a visit: its reading never counts
      stage: "quotation",
      licensePlate: PLATE,
      mileageKm: 99_000,
      lines: [SERVICE_LINE],
    });
    raw.prepare(`UPDATE onsite_sales SET created_at = 4000 WHERE id = 'm-quote'`).run();
    const detail = (await getCustomerDetail(db, PLATE)) as CustomerDetail;
    expect(detail.lastMileage).toEqual({ km: 45_000, at: 2_000 });
  });

  it("lastMileage > is null when no bill for the car recorded a mileage", async () => {
    const { raw, db } = fresh();
    await billAt(raw, db, "n-1", 1_000);
    const detail = (await getCustomerDetail(db, PLATE)) as CustomerDetail;
    expect(detail.lastMileage).toBeNull();
  });
});
