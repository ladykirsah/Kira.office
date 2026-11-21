import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  applySyncToDb,
  customerSummary,
  getCustomerDetail,
  importCustomerHistory,
  importCustomers,
  importCustomerVisits,
  listOpenDrafts,
  querySales,
  saveDraftToDb,
  searchCustomers,
  upsertCustomerByPlate,
} from "./index";

/**
 * Plan 13.11 (owner, 21 Nov 2026): a car is its plate AND its province — "[0][xx] [0000]
 * [province] · the same means everything is the same". Before this, "1กก 1234 กรุงเทพมหานคร" and
 * "1กก 1234 เชียงใหม่" were one car. Owner's pick A: a plate needs its province.
 */

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

// Run against a real SQLite built from the real migrations, so the new columns and the new
// "one car = plate + province" key are proven, not mocked.

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

const BKK = "กรุงเทพมหานคร";
const CNX = "เชียงใหม่";
const SERVICE_LINE = { lineType: "service" as const, quantity: 1, unitPriceSatang: 50000 };

/** A bill for a car, the way ทำบิล sends it. */
async function bill(db: D1Database, id: string, plate: string, province: string) {
  const out = await applySyncToDb(db, [
    { clientUuid: id, licensePlate: plate, plateProvince: province, lines: [SERVICE_LINE] },
  ]);
  expect(out.applied).toBe(1);
}

const cars = (raw: DatabaseSync) =>
  raw
    .prepare(
      `SELECT license_plate AS plate, plate_province AS province, phone FROM customers
       ORDER BY plate_province`,
    )
    .all();

describe("a car is its plate and its province (plan 13.11)", () => {
  it("upsertCustomerByPlate > given the same plate from two provinces > then two cars", async () => {
    const { raw, db } = fresh();
    await upsertCustomerByPlate(db, { licensePlate: "1กก 1234", plateProvince: BKK, phone: "081" });
    await upsertCustomerByPlate(db, { licensePlate: "1กก 1234", plateProvince: CNX, phone: "089" });
    expect(cars(raw)).toEqual([
      { plate: "1กก 1234", province: BKK, phone: "081" },
      { plate: "1กก 1234", province: CNX, phone: "089" },
    ]);
  });

  it("upsertCustomerByPlate > given the same four parts typed differently > then one car, saved by its official province", async () => {
    const { raw, db } = fresh();
    await upsertCustomerByPlate(db, {
      licensePlate: "1กก1234",
      plateProvince: "กทม",
      phone: "081",
    });
    const out = await upsertCustomerByPlate(db, {
      licensePlate: "1 กก 1234",
      plateProvince: BKK,
      notes: "ลูกค้าประจำ",
    });
    expect(out).toEqual({ ok: true, licensePlate: "1กก 1234", plateProvince: BKK });
    expect(cars(raw)).toEqual([{ plate: "1กก 1234", province: BKK, phone: "081" }]);
  });

  it("upsertCustomerByPlate > given a plate with no province > then refused, nothing saved (owner's pick A)", async () => {
    const { raw, db } = fresh();
    for (const plateProvince of [undefined, null, "", "   "]) {
      const out = await upsertCustomerByPlate(db, { licensePlate: "1กก 1234", plateProvince });
      expect(out).toEqual({ ok: false, error: "province_required" });
    }
    expect(cars(raw)).toEqual([]);
  });

  it("applySyncToDb > given a bill with a plate and a short province name > then the bill keeps the official province", async () => {
    const { raw, db } = fresh();
    await bill(db, "b-1", "1กก1234", "กทม");
    expect(
      raw
        .prepare(`SELECT license_plate AS plate, plate_province AS province FROM onsite_sales`)
        .get(),
    ).toEqual({ plate: "1กก 1234", province: BKK });
  });

  it("applySyncToDb > given a bill with a plate but no province (an old phone) > then the bill is still saved, never lost", async () => {
    const { raw, db } = fresh();
    const out = await applySyncToDb(db, [
      { clientUuid: "b-old", licensePlate: "1กก 1234", lines: [SERVICE_LINE] },
    ]);
    expect(out.applied).toBe(1);
    expect(raw.prepare(`SELECT plate_province AS province FROM onsite_sales`).get()).toEqual({
      province: "",
    });
  });

  it("saveDraftToDb > given a quotation for a car > then it keeps the province", async () => {
    const { raw, db } = fresh();
    await saveDraftToDb(db, {
      draftId: "q-1",
      stage: "quotation",
      licensePlate: "1กก 1234",
      plateProvince: "จ.เชียงใหม่",
      lines: [{ quantity: 1, unitPriceSatang: 15000, description: "ล้างแอร์" }],
    });
    expect(raw.prepare(`SELECT plate_province AS province FROM onsite_sales`).get()).toEqual({
      province: CNX,
    });
  });

  it("listOpenDrafts > given a quotation for a car > then reopening it brings the province back", async () => {
    const { db } = fresh();
    await saveDraftToDb(db, {
      draftId: "q-1",
      stage: "quotation",
      licensePlate: "1กก 1234",
      plateProvince: CNX,
      lines: [{ quantity: 1, unitPriceSatang: 15000, description: "ล้างแอร์" }],
    });
    const drafts = (await listOpenDrafts(db)) as { licensePlate: string; plateProvince: string }[];
    expect(drafts.map((d) => [d.licensePlate, d.plateProvince])).toEqual([["1กก 1234", CNX]]);
  });

  it("getCustomerDetail > given two cars with the same plate > then each page shows only its own car and bills", async () => {
    const { db } = fresh();
    await upsertCustomerByPlate(db, {
      licensePlate: "1กก 1234",
      plateProvince: BKK,
      customerName: "สมชาย",
    });
    await upsertCustomerByPlate(db, {
      licensePlate: "1กก 1234",
      plateProvince: CNX,
      customerName: "สมศรี",
    });
    await bill(db, "b-bkk", "1กก 1234", BKK);
    await bill(db, "b-cnx-1", "1กก 1234", CNX);
    await bill(db, "b-cnx-2", "1กก 1234", CNX);

    const bkk = (await getCustomerDetail(db, "1กก1234", "กทม")) as {
      customer: { customerName: string; plateProvince: string } | null;
      history: { id: string }[];
    };
    expect(bkk.customer).toMatchObject({ customerName: "สมชาย", plateProvince: BKK });
    expect(bkk.history).toHaveLength(1);

    const cnx = (await getCustomerDetail(db, "1กก 1234", CNX)) as typeof bkk;
    expect(cnx.customer).toMatchObject({ customerName: "สมศรี", plateProvince: CNX });
    expect(cnx.history).toHaveLength(2);
  });

  it("searchCustomers > given two cars with the same plate > then two rows, each with its own visits", async () => {
    const { db } = fresh();
    await bill(db, "b-bkk", "1กก 1234", BKK);
    await bill(db, "b-cnx-1", "1กก 1234", CNX);
    await bill(db, "b-cnx-2", "1กก 1234", CNX);
    const rows = (await searchCustomers(db, "1กก")) as {
      licensePlate: string;
      plateProvince: string;
      billCount: number;
    }[];
    expect(
      rows
        .map((r) => ({ plate: r.licensePlate, province: r.plateProvince, visits: r.billCount }))
        .sort((a, b) => a.province.localeCompare(b.province, "th")),
    ).toEqual([
      { plate: "1กก 1234", province: BKK, visits: 1 },
      { plate: "1กก 1234", province: CNX, visits: 2 },
    ]);
  });

  it("customerSummary > given the same plate from two provinces > then two cars are counted", async () => {
    const { db } = fresh();
    await bill(db, "b-bkk", "1กก 1234", BKK);
    await bill(db, "b-cnx", "1กก 1234", CNX);
    const out = await customerSummary(db, Date.now());
    expect(out.total).toBe(2);
    expect(out.newThisMonth).toBe(2);
  });

  it("querySales > given two cars with the same plate > then each bill shows its own car's province", async () => {
    const { db } = fresh();
    await upsertCustomerByPlate(db, { licensePlate: "1กก 1234", plateProvince: BKK });
    await upsertCustomerByPlate(db, { licensePlate: "1กก 1234", plateProvince: CNX });
    await bill(db, "b-bkk", "1กก 1234", BKK);
    await bill(db, "b-cnx", "1กก 1234", CNX);
    const rows = await querySales(db);
    expect(
      rows.map((r) => (r as unknown as { plateProvince: string }).plateProvince).sort(),
    ).toEqual([BKK, CNX].sort());
  });
});

describe("imports keep each car's province (plan 13.11)", () => {
  const CUSTOMER_MAP = {
    license_plate: "ทะเบียน",
    plate_province: "จังหวัด",
    customer_name: "ชื่อ",
  };
  const HISTORY_MAP = {
    license_plate: "ทะเบียน",
    plate_province: "จังหวัด",
    happened_at: "วันที่",
    description: "รายการ",
  };

  it("importCustomers > given the same plate from two provinces > then two cars, not a repeat", async () => {
    const { raw, db } = fresh();
    const out = await importCustomers(
      db,
      "ทะเบียน,จังหวัด,ชื่อ\n1กก 1234,กทม,สมชาย\n1กก1234,เชียงใหม่,สมศรี\n1กก 1234,กรุงเทพมหานคร,ซ้ำ\n",
      CUSTOMER_MAP,
    );
    expect(out).toMatchObject({ created: 2, duplicates: 1, invalid: 0 });
    expect(cars(raw)).toEqual([
      { plate: "1กก 1234", province: BKK, phone: null },
      { plate: "1กก 1234", province: CNX, phone: null },
    ]);
  });

  it("importCustomers > given a row with no province > then that row is refused (owner's pick A)", async () => {
    const { raw, db } = fresh();
    const out = await importCustomers(
      db,
      "ทะเบียน,จังหวัด,ชื่อ\n1กก 1234,,สมชาย\n2ขข 5678,ขอนแก่น,สมศรี\n",
      CUSTOMER_MAP,
    );
    expect(out).toMatchObject({ created: 1, invalid: 1 });
    expect(out.errors[0]?.reason).toBe("missing required field: plate_province");
    expect(cars(raw)).toEqual([{ plate: "2ขข 5678", province: "ขอนแก่น", phone: null }]);
  });

  it("importCustomers > given a sheet with no province column > then it is refused", async () => {
    const { db } = fresh();
    await expect(
      importCustomers(db, "ทะเบียน,ชื่อ\n1กก 1234,สมชาย\n", {
        license_plate: "ทะเบียน",
        customer_name: "ชื่อ",
      }),
    ).rejects.toThrow("required field not mapped: plate_province");
  });

  it("importCustomerHistory > given lines for the same plate from two provinces > then each car's page shows only its own", async () => {
    const { db } = fresh();
    const out = await importCustomerHistory(
      db,
      "ทะเบียน,จังหวัด,วันที่,รายการ\n1กก 1234,กทม,31 มีค 68,ล้างแอร์\n1กก 1234,เชียงใหม่,1 เมย 68,เติมน้ำยา\n1กก 1234,เชียงใหม่,2 เมย 68,โอริง\n",
      HISTORY_MAP,
    );
    expect(out).toMatchObject({ imported: 3, invalid: 0 });
    const page = async (province: string) =>
      ((await getCustomerDetail(db, "1กก 1234", province)) as { legacy: unknown[] }).legacy.length;
    expect(await page(BKK)).toBe(1);
    expect(await page(CNX)).toBe(2);
    const rows = (await searchCustomers(db, "")) as { plateProvince: string }[];
    expect(rows.map((r) => r.plateProvince).sort()).toEqual([BKK, CNX].sort());
  });

  it("importCustomerHistory > given a line with no province > then that line is refused", async () => {
    const { db } = fresh();
    const out = await importCustomerHistory(
      db,
      "ทะเบียน,จังหวัด,วันที่,รายการ\n1กก 1234,,31 มีค 68,ล้างแอร์\n",
      HISTORY_MAP,
    );
    expect(out).toMatchObject({ imported: 0, invalid: 1 });
  });

  it("importCustomerVisits > given visits for two cars with the same plate > then each keeps its own", async () => {
    const { db } = fresh();
    const out = await importCustomerVisits(db, [
      {
        licensePlate: "1กก 1234",
        plateProvince: "กทม",
        happenedAt: "31 มีค 68",
        lines: [{ description: "ตู้แอร์", productRef: null }],
      },
      {
        licensePlate: "1กก 1234",
        plateProvince: CNX,
        happenedAt: "31 มีค 68",
        lines: [{ description: "ตู้แอร์", productRef: null }],
      },
    ]);
    expect(out).toMatchObject({ imported: 2, duplicates: 0, invalid: 0 });
    const legacy = async (province: string) =>
      ((await getCustomerDetail(db, "1กก 1234", province)) as { legacy: unknown[] }).legacy.length;
    expect(await legacy(BKK)).toBe(1);
    expect(await legacy(CNX)).toBe(1);
  });

  it("importCustomerVisits > given a visit with no province > then it is refused, pointing at its row", async () => {
    const { db } = fresh();
    const out = await importCustomerVisits(db, [
      {
        licensePlate: "1กก 1234",
        plateProvince: "",
        happenedAt: "31 มีค 68",
        lines: [{ description: "ตู้แอร์", productRef: null }],
      },
    ]);
    expect(out).toMatchObject({ imported: 0, invalid: 1 });
    expect(out.errors).toEqual([{ rowIndex: 1, reason: "missing required field: plate_province" }]);
  });
});
