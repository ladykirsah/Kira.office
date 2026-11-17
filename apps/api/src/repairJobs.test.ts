import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { getCustomerDetail, priceBillLines } from "./index";

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
import {
  addJobLine,
  cancelRepairJob,
  changeJobLine,
  getRepairJob,
  listRepairJobs,
  moveRepairJob,
  openRepairJob,
  payRepairJob,
  removeJobLine,
  runRepairJobAction,
  setJobMechanics,
  type JobResult,
  type PriceBillLines,
  type RepairJobDetail,
} from "./repairJobs";

// งานซ่อม (plan 10.1, owner 17 Nov 2026) against a real SQLite built from the real migrations,
// foreign keys on as in D1. The owner's pick A: a part taken for a job moves ขายได้ → งานนอก, is
// sold when the customer pays, and comes back on a cancel.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

function asD1(raw: DatabaseSync): D1Database {
  const make = (sql: string) => {
    let binds: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        binds = args;
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: raw.prepare(sql).all(...(binds as never[])) as T[] };
      },
      async first<T = unknown>(): Promise<T | null> {
        return (raw.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
      },
      async run() {
        return raw.prepare(sql).run(...(binds as never[]));
      },
      __exec() {
        return raw.prepare(sql).run(...(binds as never[]));
      },
    };
    return stmt;
  };
  return {
    prepare: (sql: string) => make(sql),
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
  } as unknown as D1Database;
}

// 17 Nov 2026, 10:00 in Bangkok.
const T0 = Date.UTC(2026, 10, 17, 3, 0);
// 20 Nov 2026, 14:00 in Bangkok — when the missing part should arrive.
const ARRIVES = Date.UTC(2026, 10, 20, 7, 0);

function shop() {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    raw.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  raw.exec("PRAGMA foreign_keys = ON");
  const user = (id: string, name: string, role: string) =>
    raw
      .prepare(
        "INSERT INTO users (id, name, name_th, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', 0)",
      )
      .run(id, name, name, `${id}@shop.test`, role);
  user("u-kae", "เก๋", "super_admin");
  user("u-art", "อาร์ต", "mechanic");
  user("u-bom", "บอม", "mechanic");
  const db = asD1(raw);
  return { raw, db };
}

function product(
  raw: DatabaseSync,
  p: { id: string; name: string; stock: number; costSatang?: number },
) {
  raw.prepare("INSERT INTO products (id, name, created_at) VALUES (?, ?, 0)").run(p.id, p.name);
  raw
    .prepare("INSERT INTO product_variants (id, product_id, sku, created_at) VALUES (?, ?, ?, 0)")
    .run(`v-${p.id}`, p.id, p.id);
  raw
    .prepare(
      "INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, active_from) VALUES (?, ?, ?, 0)",
    )
    .run(`pp-${p.id}`, `v-${p.id}`, p.costSatang ?? 0);
  if (p.stock > 0) fill(raw, p.id, p.stock);
}

/** Staff fill stock the normal way (Scan › จัดการสต็อก sends a 'receive'). */
function fill(raw: DatabaseSync, productId: string, qty: number) {
  raw
    .prepare(
      `INSERT INTO stock_ledger_entries
         (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, created_at)
       VALUES (?, ?, 'receive', ?, 0, 'manual', 0)`,
    )
    .run(crypto.randomUUID(), `v-${productId}`, qty);
}

/** ขายได้ and งานนอก, read the way every page reads them. */
function stockOf(raw: DatabaseSync, productId: string) {
  const v = `v-${productId}`;
  const sellable = raw
    .prepare(
      "SELECT COALESCE(SUM(quantity_delta), 0) AS n FROM stock_ledger_entries WHERE product_variant_id = ?",
    )
    .get(v) as { n: number };
  const held = raw
    .prepare(
      `SELECT COALESCE(SUM(quantity_delta), 0) AS n FROM stock_ledger_entries
       WHERE product_variant_id = ? AND movement_type IN ('hold', 'unhold')`,
    )
    .get(v) as { n: number };
  return { sellable: Number(sellable.n), held: -Number(held.n) || 0 };
}

const kae = { userId: "u-kae", now: T0 };
const at = (minutes: number) => ({ userId: "u-kae", now: T0 + minutes * 60_000 });

function ok(r: JobResult): RepairJobDetail {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.job;
}

/** A job walked up to ลูกค้าตกลงราคา. */
async function agreedJob(db: D1Database) {
  const job = ok(await openRepairJob(db, { licensePlate: "กข1234", problem: "แอร์ไม่เย็น" }, kae));
  ok(await moveRepairJob(db, job.id, "check", at(1)));
  ok(await moveRepairJob(db, job.id, "estimate", at(2)));
  return job;
}

describe("openRepairJob > a car comes in", () => {
  it("given a plate > then เข้าใหม่ with the server's number, the plate saved one way, and the customer's first update", async () => {
    const { db } = shop();
    const job = ok(
      await openRepairJob(
        db,
        {
          licensePlate: "กข1234",
          vehicle: "Toyota Vios",
          mileageKm: 85_000,
          problem: "แอร์ไม่เย็น",
        },
        kae,
      ),
    );
    expect(job.jobNumber).toBe("JB202611-17001");
    expect(job.status).toBe("in");
    expect(job.licensePlate).toBe("กข 1234");
    expect(job.problem).toBe("แอร์ไม่เย็น");
    expect(job.events).toEqual([
      expect.objectContaining({
        kind: "opened",
        toStatus: "in",
        customerUpdate: "in",
        userName: "เก๋",
      }),
    ]);

    const second = ok(await openRepairJob(db, { licensePlate: "70-1234" }, at(5)));
    expect(second.jobNumber).toBe("JB202611-17002");
  });

  it("given no plate > then refused", async () => {
    const { db } = shop();
    expect(await openRepairJob(db, { licensePlate: "  " }, kae)).toMatchObject({
      ok: false,
      error: "plate_required",
    });
  });
});

describe("moveRepairJob > the steps", () => {
  it("given each step in turn > then who and when are kept, with the customer's update where there is one", async () => {
    const { db } = shop();
    const job = await agreedJob(db);
    const agreed = ok(await moveRepairJob(db, job.id, "agreed", at(3)));
    expect(agreed.status).toBe("agreed");
    expect(agreed.events.map((e) => [e.toStatus, e.customerUpdate])).toEqual([
      ["in", "in"],
      ["check", "check"],
      ["estimate", null],
      ["agreed", null],
    ]);
    expect(agreed.events[3]).toMatchObject({ userName: "เก๋", createdAt: T0 + 3 * 60_000 });
  });

  it("given a jump over a step > then refused and nothing changes", async () => {
    const { db } = shop();
    const job = ok(await openRepairJob(db, { licensePlate: "กข1234" }, kae));
    expect(await moveRepairJob(db, job.id, "estimate", at(1))).toMatchObject({
      ok: false,
      error: "skip",
    });
    expect((await getRepairJob(db, job.id))?.status).toBe("in");
  });

  it("given an earlier step > then it goes back (owner: backward = yes)", async () => {
    const { db } = shop();
    const job = await agreedJob(db);
    expect(ok(await moveRepairJob(db, job.id, "in", at(3))).status).toBe("in");
  });

  it("given a job that isn't there > then not found", async () => {
    const { db } = shop();
    expect(await moveRepairJob(db, "nope", "check", kae)).toMatchObject({
      ok: false,
      error: "not_found",
    });
  });
});

describe("the price estimate", () => {
  it("given lines added before the work > then they are only an estimate — no stock moves", async () => {
    const { raw, db } = shop();
    product(raw, { id: "comp", name: "คอมเพรสเซอร์ DENSO 10S11C", stock: 2 });
    const job = await agreedJob(db);
    const withLine = ok(
      await addJobLine(
        db,
        job.id,
        {
          lineType: "part",
          productVariantId: "v-comp",
          description: "คอมเพรสเซอร์ DENSO 10S11C",
          quantity: 1,
          unitPriceSatang: 450_000,
        },
        at(3),
      ),
    );
    expect(withLine.lines).toEqual([
      expect.objectContaining({ description: "คอมเพรสเซอร์ DENSO 10S11C", state: "estimate" }),
    ]);
    expect(withLine.totalSatang).toBe(450_000);
    expect(stockOf(raw, "comp")).toEqual({ sellable: 2, held: 0 });
  });

  it("given a bad line > then refused with the reason", async () => {
    const { db } = shop();
    const job = await agreedJob(db);
    expect(
      await addJobLine(
        db,
        job.id,
        { lineType: "part", description: "ท่อแอร์", quantity: 0, unitPriceSatang: 100 },
        at(3),
      ),
    ).toMatchObject({ ok: false, error: "quantity must be a whole number, 1 or more" });
  });

  it("given a product that isn't in the system > then refused", async () => {
    const { db } = shop();
    const job = await agreedJob(db);
    expect(
      await addJobLine(
        db,
        job.id,
        {
          lineType: "part",
          productVariantId: "v-ghost",
          description: "ท่อแอร์",
          quantity: 1,
          unitPriceSatang: 100,
        },
        at(3),
      ),
    ).toMatchObject({ ok: false, error: "no_such_product" });
  });
});

/**
 * The owner's mixed case: A in stock, B waiting (ran out), C a brand-new part never in the system,
 * plus labour. The team starts with what's in stock; the job shows รออะไหล่ until every part is in.
 */
async function mixedJob() {
  const { raw, db } = shop();
  product(raw, { id: "comp", name: "คอมเพรสเซอร์ DENSO 10S11C", stock: 2, costSatang: 300_000 });
  product(raw, { id: "valve", name: "วาล์วแอร์ Sanden", stock: 0, costSatang: 40_000 });
  const job = await agreedJob(db);
  const add = (input: Record<string, unknown>, minute: number) =>
    addJobLine(db, job.id, input as never, at(minute));
  ok(
    await add(
      {
        lineType: "part",
        productVariantId: "v-comp",
        description: "คอมเพรสเซอร์ DENSO 10S11C",
        quantity: 1,
        unitPriceSatang: 450_000,
      },
      3,
    ),
  );
  const withValve = ok(
    await add(
      {
        lineType: "part",
        productVariantId: "v-valve",
        description: "วาล์วแอร์ Sanden",
        quantity: 1,
        unitPriceSatang: 80_000,
        discountSatang: 5_000,
      },
      3,
    ),
  );
  const withNew = ok(
    await add(
      { lineType: "part", description: "ท่อแอร์ดัดพิเศษ", quantity: 2, unitPriceSatang: 25_000 },
      3,
    ),
  );
  ok(
    await add(
      {
        lineType: "service",
        description: "ค่าแรงเปลี่ยนคอม",
        quantity: 1,
        unitPriceSatang: 100_000,
      },
      3,
    ),
  );
  ok(await moveRepairJob(db, job.id, "agreed", at(4)));
  const lineId = (name: string) => withNew.lines.find((l) => l.description === name)!.id;
  return {
    raw,
    db,
    jobId: job.id,
    comp: lineId("คอมเพรสเซอร์ DENSO 10S11C"),
    valve: withValve.lines.find((l) => l.description === "วาล์วแอร์ Sanden")!.id,
    pipe: lineId("ท่อแอร์ดัดพิเศษ"),
  };
}

describe("start the work > the estimate goes onto the job's bill", () => {
  it("given A in stock and B + C missing > then A goes to งานนอก, B and C wait, and the job shows รออะไหล่", async () => {
    const { raw, db, jobId } = await mixedJob();
    const started = ok(await moveRepairJob(db, jobId, "working", at(5)));
    expect(started.status).toBe("waiting_parts");
    expect(started.lines.map((l) => [l.description, l.state])).toEqual([
      ["คอมเพรสเซอร์ DENSO 10S11C", "taken"],
      ["วาล์วแอร์ Sanden", "waiting"],
      ["ท่อแอร์ดัดพิเศษ", "waiting"],
      ["ค่าแรงเปลี่ยนคอม", "taken"],
    ]);
    expect(stockOf(raw, "comp")).toEqual({ sellable: 1, held: 1 });
    expect(started.events.at(-1)).toMatchObject({
      fromStatus: "agreed",
      toStatus: "waiting_parts",
      customerUpdate: "waiting_parts",
    });
  });

  it("given each waiting part's date and time > then the customer is told the last one's", async () => {
    const { db, jobId, valve, pipe } = await mixedJob();
    ok(await moveRepairJob(db, jobId, "working", at(5)));
    ok(await changeJobLine(db, jobId, valve, { expectedAt: ARRIVES - 3_600_000 }, at(6)));
    const told = ok(await changeJobLine(db, jobId, pipe, { expectedAt: ARRIVES }, at(7)));
    expect(told.waitUntil).toBe(ARRIVES);
    expect(told.events.at(-1)).toMatchObject({
      kind: "line_changed",
      customerUpdate: "waiting_parts",
      expectedAt: ARRIVES,
    });
  });

  it("given a time on a line that isn't waiting > then refused", async () => {
    const { db, jobId, comp } = await mixedJob();
    ok(await moveRepairJob(db, jobId, "working", at(5)));
    expect(await changeJobLine(db, jobId, comp, { expectedAt: ARRIVES }, at(6))).toMatchObject({
      ok: false,
      error: "expected_only_waiting",
    });
  });
});

describe("end the wait > parts arrive, staff fill stock, then move to กำลังซ่อม", () => {
  it("given parts still missing > then refused, each named, and nothing changes", async () => {
    const { raw, db, jobId } = await mixedJob();
    ok(await moveRepairJob(db, jobId, "working", at(5)));
    const refused = await moveRepairJob(db, jobId, "working", at(6));
    expect(refused).toMatchObject({
      ok: false,
      error: "parts_missing",
      parts: [
        expect.objectContaining({ description: "วาล์วแอร์ Sanden", reason: "not_in_stock" }),
        expect.objectContaining({ description: "ท่อแอร์ดัดพิเศษ", reason: "not_linked" }),
      ],
    });
    expect((await getRepairJob(db, jobId))?.status).toBe("waiting_parts");
    expect(stockOf(raw, "valve")).toEqual({ sellable: 0, held: 0 });
  });

  it("given B filled by scan, C added with เพิ่มสินค้า + filled + linked > then both go to งานนอก and the job is กำลังซ่อม", async () => {
    const { raw, db, jobId, pipe } = await mixedJob();
    ok(await moveRepairJob(db, jobId, "working", at(5)));
    fill(raw, "valve", 1); // existing product: scan › fill
    product(raw, { id: "pipe", name: "ท่อแอร์ดัดพิเศษ", stock: 2, costSatang: 10_000 }); // new
    const linked = ok(await changeJobLine(db, jobId, pipe, { productVariantId: "v-pipe" }, at(6)));
    expect(linked.lines.find((l) => l.id === pipe)).toMatchObject({
      productVariantId: "v-pipe",
      state: "waiting",
    });

    const working = ok(await moveRepairJob(db, jobId, "working", at(7)));
    expect(working.status).toBe("working");
    expect(working.lines.every((l) => l.state === "taken")).toBe(true);
    expect(stockOf(raw, "valve")).toEqual({ sellable: 0, held: 1 });
    expect(stockOf(raw, "pipe")).toEqual({ sellable: 0, held: 2 });
    expect(working.events.at(-1)).toMatchObject({
      fromStatus: "waiting_parts",
      toStatus: "working",
      customerUpdate: "working",
    });
  });

  it("given a line already linked > then it can't be linked again", async () => {
    const { db, jobId, comp } = await mixedJob();
    expect(
      await changeJobLine(db, jobId, comp, { productVariantId: "v-valve" }, at(5)),
    ).toMatchObject({ ok: false, error: "already_linked" });
  });
});

/** The mixed job, every part in and the work done. */
async function readyJob() {
  const j = await mixedJob();
  ok(await moveRepairJob(j.db, j.jobId, "working", at(5)));
  fill(j.raw, "valve", 1);
  product(j.raw, { id: "pipe", name: "ท่อแอร์ดัดพิเศษ", stock: 2, costSatang: 10_000 });
  ok(await changeJobLine(j.db, j.jobId, j.pipe, { productVariantId: "v-pipe" }, at(6)));
  ok(await moveRepairJob(j.db, j.jobId, "working", at(7)));
  return j;
}

describe("พร้อมรับรถ > the bill is issued to pay", () => {
  it("given the work done > then the bill is issued and the customer is told", async () => {
    const { db, jobId } = await readyJob();
    const ready = ok(await moveRepairJob(db, jobId, "ready", at(60)));
    expect(ready.status).toBe("ready");
    expect(ready.billIssuedAt).toBe(T0 + 60 * 60_000);
    expect(ready.events.at(-1)).toMatchObject({ toStatus: "ready", customerUpdate: "ready" });
  });

  it("given the bill issued > then lines are locked until the job goes back to กำลังซ่อม", async () => {
    const { db, jobId, comp } = await readyJob();
    ok(await moveRepairJob(db, jobId, "ready", at(60)));
    const line = {
      lineType: "service",
      description: "เติมน้ำยา",
      quantity: 1,
      unitPriceSatang: 50_000,
    };
    expect(await addJobLine(db, jobId, line, at(61))).toMatchObject({
      ok: false,
      error: "bill_issued",
    });
    expect(await removeJobLine(db, jobId, comp, at(61))).toMatchObject({
      ok: false,
      error: "bill_issued",
    });
    const back = ok(await moveRepairJob(db, jobId, "working", at(62)));
    expect(back.billIssuedAt).toBeNull();
    expect(ok(await addJobLine(db, jobId, line, at(63))).lines.at(-1)?.state).toBe("taken");
  });
});

describe("payRepairJob > the customer pays and the job closes", () => {
  it("given พร้อมรับรถ > then a paid bill with the job's number, parts sold out of งานนอก, the job closed", async () => {
    const { raw, db, jobId } = await readyJob();
    ok(await moveRepairJob(db, jobId, "ready", at(60)));
    const paid = ok(
      await payRepairJob(db, jobId, { paymentMethod: "cash" }, at(70), (l) =>
        priceBillLines(db, l),
      ),
    );

    expect(paid.status).toBe("paid");
    expect(paid.closedAt).toBe(T0 + 70 * 60_000);
    expect(paid.lines.every((l) => l.state === "sold")).toBe(true);
    expect(stockOf(raw, "comp")).toEqual({ sellable: 1, held: 0 });
    expect(stockOf(raw, "valve")).toEqual({ sellable: 0, held: 0 });
    expect(stockOf(raw, "pipe")).toEqual({ sellable: 0, held: 0 });

    const bill = raw
      .prepare(
        `SELECT sale_number, stage, sale_status, sale_type, payment_method, license_plate,
                subtotal_satang, discount_total_satang, grand_total_satang
         FROM onsite_sales WHERE id = ?`,
      )
      .get(paid.saleId!) as Record<string, unknown>;
    // 4,500 + 800 − 50 + 2 × 250 + 1,000 baht.
    expect(bill).toEqual({
      sale_number: "JB202611-17001",
      stage: "bill",
      sale_status: "completed",
      sale_type: "repair",
      payment_method: "cash",
      license_plate: "กข 1234",
      subtotal_satang: 680_000,
      discount_total_satang: 5_000,
      grand_total_satang: 675_000,
    });
    const comp = raw
      .prepare(
        `SELECT unit_cost_satang, gross_profit_satang FROM onsite_sale_lines
         WHERE onsite_sale_id = ? AND product_variant_id = 'v-comp'`,
      )
      .get(paid.saleId!) as { unit_cost_satang: number; gross_profit_satang: number };
    expect(comp.unit_cost_satang).toBe(300_000);
    expect(paid.events.at(-1)).toMatchObject({ kind: "paid", toStatus: "paid" });
  });

  it("given the paid job > then its bill is on the car's page", async () => {
    const { db, jobId } = await readyJob();
    ok(await moveRepairJob(db, jobId, "ready", at(60)));
    ok(
      await payRepairJob(db, jobId, { paymentMethod: "promptpay" }, at(70), (l) =>
        priceBillLines(db, l),
      ),
    );
    const car = (await getCustomerDetail(db, "กข 1234")) as { history: { saleNumber: string }[] };
    expect(car.history.map((b) => b.saleNumber)).toEqual(["JB202611-17001"]);
  });

  it("given the job isn't พร้อมรับรถ, or a payment kind the counter doesn't take > then refused", async () => {
    const { db, jobId } = await readyJob();
    const price: PriceBillLines = (l) => priceBillLines(db, l);
    expect(await payRepairJob(db, jobId, { paymentMethod: "cash" }, at(70), price)).toMatchObject({
      ok: false,
      error: "not_ready",
    });
    ok(await moveRepairJob(db, jobId, "ready", at(71)));
    expect(await payRepairJob(db, jobId, { paymentMethod: "card" }, at(72), price)).toMatchObject({
      ok: false,
      error: "payment_method",
    });
  });

  it("given a paid job > then nothing moves any more", async () => {
    const { db, jobId } = await readyJob();
    ok(await moveRepairJob(db, jobId, "ready", at(60)));
    ok(
      await payRepairJob(db, jobId, { paymentMethod: "cash" }, at(70), (l) =>
        priceBillLines(db, l),
      ),
    );
    expect(await moveRepairJob(db, jobId, "working", at(71))).toMatchObject({
      ok: false,
      error: "closed",
    });
    expect(await cancelRepairJob(db, jobId, "ลูกค้าเปลี่ยนใจ", at(71))).toMatchObject({
      ok: false,
      error: "closed",
    });
  });

  it("given the job's part was brought back to the shelf by hand > then it is still sold from ขายได้", async () => {
    const { raw, db, jobId } = await readyJob();
    ok(await moveRepairJob(db, jobId, "ready", at(60)));
    raw
      .prepare(
        `INSERT INTO stock_ledger_entries
           (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, created_at)
         VALUES ('manual-back', 'v-comp', 'unhold', 1, 0, 'manual', 0)`,
      )
      .run();
    ok(
      await payRepairJob(db, jobId, { paymentMethod: "cash" }, at(70), (l) =>
        priceBillLines(db, l),
      ),
    );
    expect(stockOf(raw, "comp")).toEqual({ sellable: 1, held: 0 });
  });
});

describe("removeJobLine and cancelRepairJob > parts go back, nothing is deleted", () => {
  it("given a taken part removed > then it goes back to ขายได้ and the line is kept as removed", async () => {
    const { raw, db, jobId, comp } = await readyJob();
    const after = ok(await removeJobLine(db, jobId, comp, at(30)));
    expect(after.lines.find((l) => l.id === comp)?.state).toBe("removed");
    expect(stockOf(raw, "comp")).toEqual({ sellable: 2, held: 0 });
  });

  it("given the last waiting part removed > then the job is กำลังซ่อม", async () => {
    const { db, jobId, valve, pipe } = await mixedJob();
    ok(await moveRepairJob(db, jobId, "working", at(5)));
    ok(await removeJobLine(db, jobId, valve, at(6)));
    expect(ok(await removeJobLine(db, jobId, pipe, at(7))).status).toBe("working");
  });

  it("given a cancel with a reason > then every taken part goes back and the job is kept as ยกเลิก", async () => {
    const { raw, db, jobId } = await readyJob();
    const cancelled = ok(await cancelRepairJob(db, jobId, "ลูกค้าไม่ซ่อมต่อ", at(30)));
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("ลูกค้าไม่ซ่อมต่อ");
    expect(cancelled.closedAt).toBe(T0 + 30 * 60_000);
    expect(cancelled.lines.every((l) => l.state === "removed")).toBe(true);
    expect(stockOf(raw, "comp")).toEqual({ sellable: 2, held: 0 });
    expect(stockOf(raw, "valve")).toEqual({ sellable: 1, held: 0 });
    expect(stockOf(raw, "pipe")).toEqual({ sellable: 2, held: 0 });
    expect(cancelled.events.at(-1)).toMatchObject({ kind: "cancelled", note: "ลูกค้าไม่ซ่อมต่อ" });
  });

  it("given no reason > then refused", async () => {
    const { db, jobId } = await mixedJob();
    expect(await cancelRepairJob(db, jobId, " ", at(5))).toMatchObject({
      ok: false,
      error: "reason_required",
    });
  });
});

describe("mechanics and the lists", () => {
  it("given one or several mechanics > then the job names them", async () => {
    const { db } = shop();
    const job = ok(await openRepairJob(db, { licensePlate: "กข1234" }, kae));
    const two = ok(await setJobMechanics(db, job.id, ["u-art", "u-bom"], at(1)));
    expect(two.mechanics.map((m) => m.name)).toEqual(["บอม", "อาร์ต"]);
    expect(ok(await setJobMechanics(db, job.id, ["u-art"], at(2))).mechanics).toEqual([
      { userId: "u-art", name: "อาร์ต" },
    ]);
    expect(await setJobMechanics(db, job.id, ["u-ghost"], at(3))).toMatchObject({
      ok: false,
      error: "no_such_staff",
    });
  });

  it("given jobs in several steps > then counts per step, a mechanic's open jobs, and a car's jobs", async () => {
    const { db } = shop();
    const a = ok(await openRepairJob(db, { licensePlate: "กข1234" }, kae));
    const b = ok(await openRepairJob(db, { licensePlate: "70-1234" }, at(1)));
    ok(await openRepairJob(db, { licensePlate: "กข1234" }, at(2)));
    ok(await moveRepairJob(db, b.id, "check", at(3)));
    ok(await setJobMechanics(db, b.id, ["u-art"], at(4)));
    ok(await cancelRepairJob(db, a.id, "ลูกค้าไม่มา", at(5)));

    const all = await listRepairJobs(db, {});
    expect(all.counts).toEqual({ in: 1, check: 1, cancelled: 1 });
    expect(all.jobs.map((j) => j.jobNumber)).toEqual([
      "JB202611-17003",
      "JB202611-17002",
      "JB202611-17001",
    ]);

    const arts = await listRepairJobs(db, { mechanicId: "u-art", open: true });
    expect(arts.jobs.map((j) => [j.jobNumber, j.mechanics])).toEqual([
      ["JB202611-17002", ["อาร์ต"]],
    ]);

    const car = await listRepairJobs(db, { plate: "กข 1234" });
    expect(car.jobs.map((j) => j.jobNumber)).toEqual(["JB202611-17003", "JB202611-17001"]);

    const open = await listRepairJobs(db, { open: true });
    expect(open.jobs).toHaveLength(2);
  });
});

describe("runRepairJobAction > the StockLedger object's one door", () => {
  it("given an open, a move and a pay > then each reaches its own job write", async () => {
    const { raw, db } = shop();
    product(raw, { id: "comp", name: "คอมเพรสเซอร์ DENSO 10S11C", stock: 1 });
    const price: PriceBillLines = (l) => priceBillLines(db, l);
    const run = (action: Parameters<typeof runRepairJobAction>[1], minute: number) =>
      runRepairJobAction(db, action, at(minute), price);
    const job = ok(await run({ kind: "open", input: { licensePlate: "กข1234" } }, 0));
    for (const [i, to] of (["check", "estimate"] as const).entries()) {
      ok(await run({ kind: "move", jobId: job.id, to }, i + 1));
    }
    ok(
      await run(
        {
          kind: "addLine",
          jobId: job.id,
          input: {
            lineType: "part",
            productVariantId: "v-comp",
            description: "คอมเพรสเซอร์ DENSO 10S11C",
            quantity: 1,
            unitPriceSatang: 450_000,
          },
        },
        3,
      ),
    );
    for (const [i, to] of (["agreed", "working", "ready"] as const).entries()) {
      ok(await run({ kind: "move", jobId: job.id, to }, i + 4));
    }
    const paid = ok(await run({ kind: "pay", jobId: job.id, input: { paymentMethod: "cash" } }, 9));
    expect(paid.status).toBe("paid");
    expect(stockOf(raw, "comp")).toEqual({ sellable: 0, held: 0 });
  });
});
