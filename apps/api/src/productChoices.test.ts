import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  addChoice,
  addToGroup,
  readChoices,
  readGroup,
  removeChoice,
  removeFromGroup,
  renameOption,
  setChoiceImage,
  setUpChoices,
  updateChoice,
  type ChoicePriceInput,
} from "./productChoices";
import { createStaffSession } from "./staffSession";
import { getCustomerDetail, getOrderDetail, listCampaignsAdmin } from "./index";
import { listStockMovements } from "./stockMovements";

// `cloudflare:workers` only exists inside the Workers runtime; the Worker's Durable Object extends
// its base class, so importing the Worker for the route tests needs this stand-in.
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
const { default: worker } = await import("./index");
type Env = import("./index").Env;

/**
 * ตัวเลือกสินค้า (sizes) and กลุ่มสินค้า (groups) on หน้าสินค้า, drawn and approved 7 Nov 2026.
 * Every test runs against a real sqlite built from the real migrations.
 */

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

function migrated(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    db.exec("BEGIN");
    db.exec(readFileSync(join(migrationsDir, f), "utf8"));
    db.exec("COMMIT");
  }
  return db;
}

/** The slice of D1 these functions use, with an atomic batch like the real one. */
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

const NOW = 1_800_000_000_000;

interface Seed {
  id: string;
  ref: string;
  name?: string;
  price?: number;
  stock?: number;
  type?: string | null;
  brand?: string | null;
}

/** A product the way the add form saves one: a variant whose barcode is the code, a price, stock. */
function addProduct(raw: DatabaseSync, s: Seed) {
  const v = `${s.id}-v1`;
  raw
    .prepare(
      `INSERT INTO products (id, product_ref, name, status, created_at, type_id, brand_id, image_key)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
    )
    .run(
      s.id,
      s.ref,
      s.name ?? `ตู้แอร์ ${s.ref}`,
      NOW,
      s.type ?? null,
      s.brand ?? null,
      `products/${s.id}/cover.jpg`,
    );
  raw
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, barcode_primary, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
    )
    .run(v, s.id, s.ref, s.ref, NOW);
  raw
    .prepare(
      `INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at)
       VALUES (?, ?, ?, 1, 0, ?)`,
    )
    .run(`${v}-bc`, v, s.ref, NOW);
  raw
    .prepare(
      `INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, target_price_satang,
         online_price_satang, shopee_price_satang, b2b_price_satang, online_commission_bp, tax_on_cost, active_from)
       VALUES (?, ?, 1200, ?, 3000, 3000, 2500, 0, 0, ?)`,
    )
    .run(`${v}-pp`, v, s.price ?? 3500, NOW);
  if (s.stock) {
    raw
      .prepare(
        `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, created_at)
         VALUES (?, ?, 'manual_adjustment', ?, ?, ?)`,
      )
      .run(`${v}-in`, v, s.stock, s.stock, NOW);
  }
  return v;
}

function setup() {
  const raw = migrated();
  const db = asD1(raw);
  return { raw, db };
}

const PRICE: ChoicePriceInput = {
  itemCostSatang: 1200,
  targetPriceSatang: 4500,
  onlinePriceSatang: 3000,
  shopeePriceSatang: 3000,
  b2bPriceSatang: 2500,
  onlineCommissionBp: 0,
  taxOnCost: false,
};

const SIZES = ["3/8 เล็ก", "1/2 กลาง", "5/8 ใหญ่"];

describe("readChoices", () => {
  it("given a product with no choices > then no option name and no choices", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    expect(await readChoices(db, "oring")).toEqual({ optionName: null, choices: [] });
  });
});

describe("setUpChoices > the first เพิ่มตัวเลือก sheet", () => {
  it("given a name and three values > then three choices in that order, the first keeping the product's code, price and stock", async () => {
    const { raw, db } = setup();
    const first = addProduct(raw, { id: "oring", ref: "TG949142-00104D", price: 3500, stock: 100 });
    expect(await setUpChoices(db, "oring", " ขนาด ", SIZES)).toEqual({ ok: true });
    const out = await readChoices(db, "oring");
    expect(out.optionName).toBe("ขนาด");
    expect(out.choices.map((c) => c.value)).toEqual(SIZES);
    expect(out.choices[0]).toMatchObject({
      variantId: first,
      code: "TG949142-00104D",
      onHand: 100,
      held: 0,
      inUse: true,
    });
    expect(out.choices[0]!.pricing?.targetPriceSatang).toBe(3500);
  });

  it("given the new values > then each starts empty: no code, no price, no stock, nothing to stop its removal", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D", stock: 100 });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const second = (await readChoices(db, "oring")).choices[1]!;
    expect(second).toMatchObject({
      value: "1/2 กลาง",
      code: null,
      imageKey: null,
      onHand: 0,
      held: 0,
      inUse: false,
      pricing: null,
    });
  });

  it("given a product that already has choices > then it is refused (more go through + เพิ่มตัวเลือก)", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    expect(await setUpChoices(db, "oring", "ขนาด", ["7/8"])).toEqual({
      ok: false,
      reason: "has_choices",
    });
  });

  it("given an empty name, no values, an empty value or the same value twice > then refused and nothing changes", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    expect(await setUpChoices(db, "oring", "  ", SIZES)).toEqual({
      ok: false,
      reason: "name_missing",
    });
    expect(await setUpChoices(db, "oring", "ขนาด", [])).toEqual({
      ok: false,
      reason: "value_missing",
    });
    expect(await setUpChoices(db, "oring", "ขนาด", ["3/8 เล็ก", " "])).toEqual({
      ok: false,
      reason: "value_missing",
    });
    expect(await setUpChoices(db, "oring", "ขนาด", ["3/8 เล็ก", "3/8 เล็ก "])).toEqual({
      ok: false,
      reason: "value_taken",
    });
    expect((await readChoices(db, "oring")).choices).toEqual([]);
  });

  it("given a product that does not exist > then not found", async () => {
    const { db } = setup();
    expect(await setUpChoices(db, "nope", "ขนาด", SIZES)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("renameOption > ชื่อกลุ่ม in แก้ไข", () => {
  it("given a new name > then every choice carries it", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    expect(await renameOption(db, "oring", "ไซซ์")).toEqual({ ok: true });
    expect((await readChoices(db, "oring")).optionName).toBe("ไซซ์");
  });

  it("given an empty name > then refused", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    expect(await renameOption(db, "oring", " ")).toEqual({ ok: false, reason: "name_missing" });
  });
});

describe("addChoice > the new size form", () => {
  it("given a value, a code and prices > then a new choice with that code, those prices and no stock", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const out = await addChoice(db, "oring", {
      value: " 3/4 ใหญ่มาก ",
      code: " TG949142-00404D ",
      pricing: PRICE,
    });
    expect(out.ok).toBe(true);
    const added = (await readChoices(db, "oring")).choices.at(-1)!;
    expect(added).toMatchObject({
      value: "3/4 ใหญ่มาก",
      code: "TG949142-00404D",
      onHand: 0,
      inUse: false,
    });
    expect(added.pricing?.targetPriceSatang).toBe(4500);
    // Its code is a barcode the way a product's is, so Scan can find it later.
    const bc = raw
      .prepare("SELECT product_variant_id AS v FROM barcodes WHERE barcode_value = ?")
      .get("TG949142-00404D") as { v: string } | undefined;
    expect(bc?.v).toBe(added.variantId);
  });

  it("given a code another product or choice already has > then code_taken", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    addProduct(raw, { id: "other", ref: "DN-447220" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    expect(
      await addChoice(db, "oring", { value: "7/8", code: "DN-447220", pricing: PRICE }),
    ).toEqual({ ok: false, reason: "code_taken" });
    expect(
      await addChoice(db, "oring", { value: "7/8", code: "TG949142-00104D", pricing: PRICE }),
    ).toEqual({ ok: false, reason: "code_taken" });
  });

  it("given a value the product already has, or an empty value or code > then refused", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    expect(
      await addChoice(db, "oring", { value: "1/2 กลาง", code: "X-1", pricing: PRICE }),
    ).toEqual({
      ok: false,
      reason: "value_taken",
    });
    expect(await addChoice(db, "oring", { value: " ", code: "X-1", pricing: PRICE })).toEqual({
      ok: false,
      reason: "value_missing",
    });
    expect(await addChoice(db, "oring", { value: "7/8", code: " ", pricing: PRICE })).toEqual({
      ok: false,
      reason: "code_missing",
    });
  });

  it("given a product with no choices yet > then no_choices (the first sheet sets them up)", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    expect(await addChoice(db, "oring", { value: "7/8", code: "X-1", pricing: PRICE })).toEqual({
      ok: false,
      reason: "no_choices",
    });
  });
});

describe("updateChoice > แก้ไขตัวเลือก", () => {
  it("given a new value, code and prices > then the choice reads them back", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const second = (await readChoices(db, "oring")).choices[1]!;
    expect(
      await updateChoice(db, "oring", second.variantId, {
        value: "1/2 กลาง",
        code: "TG949142-00204D",
        pricing: PRICE,
      }),
    ).toEqual({ ok: true });
    const after = (await readChoices(db, "oring")).choices[1]!;
    expect(after.code).toBe("TG949142-00204D");
    expect(after.pricing?.targetPriceSatang).toBe(4500);
  });

  it("given its own code back > then saved (a code is only taken by someone else)", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const first = (await readChoices(db, "oring")).choices[0]!;
    expect(
      await updateChoice(db, "oring", first.variantId, {
        value: "3/8 เล็กสุด",
        code: "TG949142-00104D",
        pricing: PRICE,
      }),
    ).toEqual({ ok: true });
    expect((await readChoices(db, "oring")).choices[0]!.value).toBe("3/8 เล็กสุด");
  });

  it("given a changed code > then the old code no longer finds it and the new one does", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const second = (await readChoices(db, "oring")).choices[1]!;
    await updateChoice(db, "oring", second.variantId, {
      value: "1/2 กลาง",
      code: "A-1",
      pricing: PRICE,
    });
    await updateChoice(db, "oring", second.variantId, {
      value: "1/2 กลาง",
      code: "A-2",
      pricing: PRICE,
    });
    const codes = raw
      .prepare("SELECT barcode_value AS c FROM barcodes WHERE product_variant_id = ?")
      .all(second.variantId) as { c: string }[];
    expect(codes.map((r) => r.c)).toEqual(["A-2"]);
  });

  it("given another choice's value or code, or a variant of another product > then refused", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    const otherVariant = addProduct(raw, { id: "other", ref: "DN-447220" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const second = (await readChoices(db, "oring")).choices[1]!;
    expect(
      await updateChoice(db, "oring", second.variantId, {
        value: "5/8 ใหญ่",
        code: "Z-1",
        pricing: PRICE,
      }),
    ).toEqual({ ok: false, reason: "value_taken" });
    expect(
      await updateChoice(db, "oring", second.variantId, {
        value: "1/2 กลาง",
        code: "DN-447220",
        pricing: PRICE,
      }),
    ).toEqual({ ok: false, reason: "code_taken" });
    expect(
      await updateChoice(db, "oring", otherVariant, { value: "x", code: "Z-2", pricing: PRICE }),
    ).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("removeChoice > 🗑 and เอาตัวเลือกนี้ออก", () => {
  it("given a choice nothing has happened to > then it goes, with its code and prices", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D", stock: 100 });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const second = (await readChoices(db, "oring")).choices[1]!;
    await updateChoice(db, "oring", second.variantId, {
      value: "1/2 กลาง",
      code: "A-1",
      pricing: PRICE,
    });
    expect(await removeChoice(db, "oring", second.variantId)).toEqual({ ok: true });
    expect((await readChoices(db, "oring")).choices.map((c) => c.value)).toEqual([
      "3/8 เล็ก",
      "5/8 ใหญ่",
    ]);
    const left = raw
      .prepare("SELECT COUNT(*) AS n FROM barcodes WHERE barcode_value = 'A-1'")
      .get() as { n: number };
    expect(left.n).toBe(0);
  });

  it("given a choice with stock history or sales > then in_use (sold already, it stays)", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D", stock: 100 });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const first = (await readChoices(db, "oring")).choices[0]!;
    expect(await removeChoice(db, "oring", first.variantId)).toEqual({
      ok: false,
      reason: "in_use",
    });
  });

  it("given the only choice left > then last_choice (a product always keeps one)", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", ["3/8 เล็ก", "1/2 กลาง"]);
    const [a, b] = (await readChoices(db, "oring")).choices;
    expect(await removeChoice(db, "oring", b!.variantId)).toEqual({ ok: true });
    expect(await removeChoice(db, "oring", a!.variantId)).toEqual({
      ok: false,
      reason: "last_choice",
    });
  });
});

describe("setChoiceImage > the choice's one photo", () => {
  it("given a stored photo > then the choice reads it back", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const second = (await readChoices(db, "oring")).choices[1]!;
    expect(await setChoiceImage(db, "oring", second.variantId, "products/oring/half.jpg")).toEqual({
      ok: true,
    });
    expect((await readChoices(db, "oring")).choices[1]!.imageKey).toBe("products/oring/half.jpg");
  });
});

describe("groups > กลุ่มสินค้า", () => {
  function three(raw: DatabaseSync) {
    // The seeded part type has no Thai name yet; the page shows the Thai one when it has one.
    raw.prepare(`UPDATE product_types SET name_th = 'ตู้แอร์' WHERE id = 'pt-evaporator'`).run();
    addProduct(raw, {
      id: "denso",
      ref: "TG447610-72904D",
      price: 260000,
      stock: 17,
      type: "pt-evaporator",
      brand: "br-denso",
    });
    addProduct(raw, { id: "vinn", ref: "EVA110010", price: 110000, stock: 3 });
    addProduct(raw, { id: "formula", ref: "9700-0001-00", price: 150000, stock: 1 });
  }

  it("given a product in no group > then no members", async () => {
    const { raw, db } = setup();
    three(raw);
    expect(await readGroup(db, "denso")).toEqual([]);
  });

  it("given two products added > then all three list each other, each with its name parts, photo, stock and price", async () => {
    const { raw, db } = setup();
    three(raw);
    expect(await addToGroup(db, "denso", ["vinn", "formula"])).toEqual({ ok: true });
    for (const id of ["denso", "vinn", "formula"]) {
      expect((await readGroup(db, id)).map((m) => m.id).sort()).toEqual([
        "denso",
        "formula",
        "vinn",
      ]);
    }
    const denso = (await readGroup(db, "vinn")).find((m) => m.id === "denso")!;
    expect(denso).toEqual({
      id: "denso",
      name: "ตู้แอร์ TG447610-72904D",
      productRef: "TG447610-72904D",
      typeName: "Evaporator",
      typeNameTh: "ตู้แอร์",
      brandName: "DENSO",
      imageKey: "products/denso/cover.jpg",
      onHand: 17,
      priceSatang: 260000,
      choiceCount: 1,
    });
  });

  it("given a member with sizes > then it counts its sizes, adds their stock and shows its cheapest size's price", async () => {
    const { raw, db } = setup();
    three(raw);
    await oringWithSizes(raw, db);
    expect(await addToGroup(db, "denso", ["oring"])).toEqual({ ok: true });
    const oring = (await readGroup(db, "denso")).find((m) => m.id === "oring")!;
    expect(oring).toMatchObject({ choiceCount: 3, onHand: 107, priceSatang: 3500 });
  });

  it("given a product that is already in another group > then the two groups become one", async () => {
    const { raw, db } = setup();
    three(raw);
    addProduct(raw, { id: "coolgear", ref: "DI446610-28804W" });
    await addToGroup(db, "vinn", ["coolgear"]);
    await addToGroup(db, "denso", ["vinn"]);
    expect((await readGroup(db, "formula")).length).toBe(0);
    expect((await readGroup(db, "coolgear")).map((m) => m.id).sort()).toEqual([
      "coolgear",
      "denso",
      "vinn",
    ]);
  });

  it("given an id that is not a product, or none > then refused and no group is made", async () => {
    const { raw, db } = setup();
    three(raw);
    expect(await addToGroup(db, "denso", ["ghost"])).toEqual({ ok: false, reason: "not_found" });
    expect(await addToGroup(db, "denso", [])).toEqual({ ok: false, reason: "not_found" });
    expect(await readGroup(db, "denso")).toEqual([]);
  });

  it("given a member taken out > then it is in no group and the others stay together", async () => {
    const { raw, db } = setup();
    three(raw);
    await addToGroup(db, "denso", ["vinn", "formula"]);
    expect(await removeFromGroup(db, "denso", "vinn")).toEqual({ ok: true });
    expect(await readGroup(db, "vinn")).toEqual([]);
    expect((await readGroup(db, "denso")).map((m) => m.id).sort()).toEqual(["denso", "formula"]);
    // The product itself is still there.
    expect(raw.prepare("SELECT id FROM products WHERE id = 'vinn'").get()).toBeTruthy();
  });

  it("given the second-to-last member taken out > then the last one leaves too (no group of one)", async () => {
    const { raw, db } = setup();
    three(raw);
    await addToGroup(db, "denso", ["vinn"]);
    await removeFromGroup(db, "denso", "vinn");
    expect(await readGroup(db, "denso")).toEqual([]);
  });

  it("given a product that is not in this group > then not_found", async () => {
    const { raw, db } = setup();
    three(raw);
    await addToGroup(db, "denso", ["vinn"]);
    expect(await removeFromGroup(db, "denso", "formula")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

// ── Through the real routes ──────────────────────────────────────────────────────────────────────

async function signedIn(raw: DatabaseSync, db: D1Database, role: string) {
  raw
    .prepare(
      `INSERT INTO users (id, name, email, role, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
    )
    .run(role, role, `${role}@shop.test`, role, NOW);
  return (await createStaffSession(db, role, Date.now())).token;
}

function call(db: D1Database, token: string, method: string, path: string, body?: unknown) {
  return worker.fetch!(
    new Request(`https://x${path}`, {
      method,
      headers: { "X-Staff-Session": token, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { DB: db } as unknown as Env,
    {} as ExecutionContext,
  );
}

describe("routes > ตัวเลือกสินค้า and กลุ่มสินค้า", () => {
  it("given GET /products/:id > then the page gets its option name, choices and group, with CORS", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D", stock: 100 });
    addProduct(raw, { id: "other", ref: "DN-447220" });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    await addToGroup(db, "oring", ["other"]);
    const token = await signedIn(raw, db, "super_admin");
    const res = await call(db, token, "GET", "/products/oring");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await res.json()) as {
      optionName: string;
      choices: { value: string }[];
      group: { id: string }[];
    };
    expect(body.optionName).toBe("ขนาด");
    expect(body.choices.map((c) => c.value)).toEqual(SIZES);
    expect(body.group.map((m) => m.id).sort()).toEqual(["oring", "other"]);
  });

  it("given POST /options then PUT /options > then the choices are set up, then renamed", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    const token = await signedIn(raw, db, "super_admin");
    const made = await call(db, token, "POST", "/products/oring/options", {
      name: "ขนาด",
      values: SIZES,
    });
    expect(made.status).toBe(201);
    expect((await call(db, token, "PUT", "/products/oring/options", { name: "ไซซ์" })).status).toBe(
      200,
    );
    expect((await readChoices(db, "oring")).optionName).toBe("ไซซ์");
    const again = await call(db, token, "POST", "/products/oring/options", {
      name: "ขนาด",
      values: ["7/8"],
    });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ reason: "has_choices" });
  });

  it("given an empty value box > then 400 with the reason, so the form can put it under the box", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    const token = await signedIn(raw, db, "super_admin");
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const res = await call(db, token, "POST", "/products/oring/choices", {
      value: " ",
      code: "X-1",
      pricing: PRICE,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: "value_missing" });
  });

  it("given an admin changing a choice's selling price > then refused; the cost alone is theirs", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D", price: 3500 });
    await setUpChoices(db, "oring", "ขนาด", SIZES);
    const first = (await readChoices(db, "oring")).choices[0]!;
    const token = await signedIn(raw, db, "admin");
    const body = (pricing: ChoicePriceInput) => ({
      value: first.value,
      code: "TG949142-00104D",
      pricing,
    });
    const kept = {
      itemCostSatang: 1200,
      targetPriceSatang: 3500,
      onlinePriceSatang: 3000,
      shopeePriceSatang: 3000,
      b2bPriceSatang: 2500,
      onlineCommissionBp: 0,
      taxOnCost: false,
    };
    const raised = await call(
      db,
      token,
      "PUT",
      `/products/oring/choices/${first.variantId}`,
      body({ ...kept, targetPriceSatang: 9900 }),
    );
    expect(raised.status).toBe(403);
    const cost = await call(
      db,
      token,
      "PUT",
      `/products/oring/choices/${first.variantId}`,
      body({ ...kept, itemCostSatang: 1500 }),
    );
    expect(cost.status).toBe(200);
    expect((await readChoices(db, "oring")).choices[0]!.pricing?.itemCostSatang).toBe(1500);
  });

  it("given a mechanic > then every size and group change is refused (the catalog is read-only for them)", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    addProduct(raw, { id: "other", ref: "DN-447220" });
    const token = await signedIn(raw, db, "mechanic");
    const tries = [
      call(db, token, "POST", "/products/oring/options", { name: "ขนาด", values: SIZES }),
      call(db, token, "POST", "/products/oring/group", { productIds: ["other"] }),
      call(db, token, "DELETE", "/products/oring/group/other"),
    ];
    for (const res of await Promise.all(tries)) expect(res.status).toBe(403);
    expect(await readGroup(db, "oring")).toEqual([]);
  });

  it("given POST /group then DELETE /group/:member > then the group is made, then the member leaves", async () => {
    const { raw, db } = setup();
    addProduct(raw, { id: "oring", ref: "TG949142-00104D" });
    addProduct(raw, { id: "other", ref: "DN-447220" });
    addProduct(raw, { id: "third", ref: "DN-116340" });
    const token = await signedIn(raw, db, "super_admin");
    const made = await call(db, token, "POST", "/products/oring/group", {
      productIds: ["other", "third"],
    });
    expect(made.status).toBe(200);
    expect((await call(db, token, "DELETE", "/products/oring/group/other")).status).toBe(200);
    expect((await readGroup(db, "oring")).map((m) => m.id).sort()).toEqual(["oring", "third"]);
    expect((await call(db, token, "DELETE", "/products/oring/group/other")).status).toBe(404);
  });
});

// ── Size-aware reads for Scan, ทำบิล, labels and แฟลชเซล (owner, 7 Nov: "fix backend") ─────────────

function stockIn(raw: DatabaseSync, variantId: string, qty: number) {
  raw
    .prepare(
      `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, created_at)
       VALUES (?, ?, 'manual_adjustment', ?, ?, ?)`,
    )
    .run(`${variantId}-in-${qty}`, variantId, qty, qty, NOW);
}

/** The O-ring with three sizes: 3/8 (the product itself, 100 in stock), 1/2 (7), 5/8 (none). */
async function oringWithSizes(raw: DatabaseSync, db: D1Database) {
  const first = addProduct(raw, { id: "oring", ref: "TG949142-00104D", stock: 100 });
  await setUpChoices(db, "oring", "ขนาด", ["3/8 เล็ก"]);
  const half = await addChoice(db, "oring", {
    value: "1/2 กลาง",
    code: "TG949142-00204D",
    pricing: { ...PRICE, targetPriceSatang: 4500 },
  });
  const fiveEighths = await addChoice(db, "oring", {
    value: "5/8 ใหญ่",
    code: "TG949142-00304D",
    pricing: { ...PRICE, targetPriceSatang: 5500 },
  });
  const ids = (await readChoices(db, "oring")).choices.map((c) => c.variantId);
  expect(half.ok && fiveEighths.ok).toBe(true);
  stockIn(raw, ids[1]!, 7);
  return { first, ids };
}

interface ListRow {
  id: string;
  variantId: string;
  optionValue?: string | null;
  code?: string | null;
  imageKey?: string | null;
  onHand: number;
  totalOnHand?: number;
  choiceCount?: number;
  fromPriceSatang?: number;
  offlinePriceSatang: number;
}

async function listRows(db: D1Database, token: string, query = ""): Promise<ListRow[]> {
  const res = await call(db, token, "GET", `/products${query}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { products: ListRow[] }).products;
}

describe("GET /products?by=variant > one row per size, for ทำบิล, labels and แฟลชเซล", () => {
  it("given a product with three sizes and one without > then each size is its own row with its own code, price and stock", async () => {
    const { raw, db } = setup();
    await oringWithSizes(raw, db);
    addProduct(raw, { id: "plain", ref: "DN-447220", stock: 4 });
    const token = await signedIn(raw, db, "super_admin");
    const rows = await listRows(db, token, "?by=variant");
    const oring = rows.filter((r) => r.id === "oring");
    expect(oring.map((r) => [r.optionValue, r.code, r.onHand, r.offlinePriceSatang])).toEqual([
      ["3/8 เล็ก", "TG949142-00104D", 100, 3500],
      ["1/2 กลาง", "TG949142-00204D", 7, 4500],
      ["5/8 ใหญ่", "TG949142-00304D", 0, 5500],
    ]);
    const plain = rows.find((r) => r.id === "plain")!;
    expect(plain).toMatchObject({ optionValue: null, code: "DN-447220", onHand: 4 });
  });

  it("given a size with its own photo > then its row shows that photo; the others show the product's", async () => {
    const { raw, db } = setup();
    const { ids } = await oringWithSizes(raw, db);
    await setChoiceImage(db, "oring", ids[1]!, "products/oring/half.jpg");
    const token = await signedIn(raw, db, "super_admin");
    const rows = (await listRows(db, token, "?by=variant")).filter((r) => r.id === "oring");
    expect(rows.map((r) => r.imageKey)).toEqual([
      "products/oring/cover.jpg",
      "products/oring/half.jpg",
      "products/oring/cover.jpg",
    ]);
  });
});

describe("GET /products > the product list keeps one row per product", () => {
  it("given a product with three sizes > then one row, its size count, and the stock of all sizes together beside the first size's", async () => {
    const { raw, db } = setup();
    await oringWithSizes(raw, db);
    addProduct(raw, { id: "plain", ref: "DN-447220", stock: 4 });
    const token = await signedIn(raw, db, "super_admin");
    const rows = await listRows(db, token);
    const oring = rows.filter((r) => r.id === "oring");
    expect(oring).toHaveLength(1);
    // onHand stays the first size's: the list's สต็อกและราคา sheet edits that size.
    expect(oring[0]).toMatchObject({ choiceCount: 3, onHand: 100, totalOnHand: 107 });
    expect(rows.find((r) => r.id === "plain")).toMatchObject({ choiceCount: 1, totalOnHand: 4 });
  });

  it("given sizes at different prices > then the row carries the cheapest size's เด่นแอร์ price for its เริ่ม ฿", async () => {
    const { raw, db } = setup();
    await oringWithSizes(raw, db);
    addProduct(raw, { id: "plain", ref: "DN-447220", stock: 4, price: 120000 });
    const token = await signedIn(raw, db, "super_admin");
    const rows = await listRows(db, token);
    expect(rows.find((r) => r.id === "oring")).toMatchObject({ fromPriceSatang: 3500 });
    expect(rows.find((r) => r.id === "plain")).toMatchObject({ fromPriceSatang: 120000 });
  });
});

describe("reads name the size that was sold or put on sale (7 Nov 2026)", () => {
  it("given an AirPlus order for one size > then the order's item line names that size", async () => {
    const { raw, db } = setup();
    const { ids } = await oringWithSizes(raw, db);
    raw
      .prepare(
        `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
           grand_total_satang, order_created_at, imported_at)
         VALUES ('o1', 'airplus', 'AP-1', 'paid', 'paid', 4500, ?, ?)`,
      )
      .run(NOW, NOW);
    raw
      .prepare(
        `INSERT INTO sales_order_lines (id, sales_order_id, product_variant_id, quantity,
           unit_price_satang, line_total_satang, created_at)
         VALUES ('l1', 'o1', ?, 1, 4500, 4500, ?)`,
      )
      .run(ids[1]!, NOW);
    const d = (await getOrderDetail(db, "o1")) as unknown as {
      lines: { choiceValue: string | null; choiceCode: string | null }[];
    };
    expect(d.lines.map((l) => [l.choiceValue, l.choiceCode])).toEqual([
      ["1/2 กลาง", "TG949142-00204D"],
    ]);
  });

  it("given a bill with one size > then the customer's bill line names that size", async () => {
    const { raw, db } = setup();
    const { ids } = await oringWithSizes(raw, db);
    raw
      .prepare(
        `INSERT INTO onsite_sales (id, client_uuid, sale_number, license_plate, stage, payment_method, created_at)
         VALUES ('s1', 'u-s1', 'B-1', '1กก 1234', 'bill', 'cash', ?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO onsite_sale_lines (id, onsite_sale_id, product_variant_id, line_type, description,
           quantity, unit_price_satang)
         VALUES ('sl1', 's1', ?, 'part', 'โอริง R134a DENSO', 2, 4500)`,
      )
      .run(ids[1]!);
    const d = JSON.stringify(await getCustomerDetail(db, "1กก 1234"));
    expect(d).toContain('"choiceValue":"1/2 กลาง"');
    expect(d).toContain('"choiceCode":"TG949142-00204D"');
  });

  it("given a flash sale on one size > then its price line names the size and shows the size's photo", async () => {
    const { raw, db } = setup();
    const { ids } = await oringWithSizes(raw, db);
    await setChoiceImage(db, "oring", ids[1]!, "products/oring/half.jpg");
    raw
      .prepare(
        `INSERT INTO campaigns (id, name, starts_at, ends_at, status, created_at)
         VALUES ('c1', 'ลดโอริง', ?, ?, 'active', ?)`,
      )
      .run(NOW, NOW + 86_400_000, NOW);
    raw
      .prepare(
        `INSERT INTO campaign_prices (id, campaign_id, product_variant_id, campaign_price_satang, created_at)
         VALUES ('cp1', 'c1', ?, 3900, ?)`,
      )
      .run(ids[1]!, NOW);
    const [sale] = await listCampaignsAdmin(db);
    expect(sale!.prices[0]).toMatchObject({
      choiceValue: "1/2 กลาง",
      choiceCode: "TG949142-00204D",
      imageKey: "products/oring/half.jpg",
    });
  });
});

describe("ประวัติซื้อขาย > each size's stock change names its size (11 Nov 2026)", () => {
  it("given stock received on one size > then its row carries the size, its own code and its photo", async () => {
    const { raw, db } = setup();
    const { ids } = await oringWithSizes(raw, db);
    await setChoiceImage(db, "oring", ids[1]!, "products/oring/half.jpg");
    const { movements } = await listStockMovements(db, null);
    const half = movements.find((m) => m.variantId === ids[1]);
    expect(half).toMatchObject({
      choiceValue: "1/2 กลาง",
      choiceCode: "TG949142-00204D",
      imageKey: "products/oring/half.jpg",
    });
    const first = movements.find((m) => m.variantId === ids[0]);
    expect(first).toMatchObject({ choiceValue: "3/8 เล็ก", choiceCode: "TG949142-00104D" });
  });
});

describe("GET /stock > each size's stock row names its size", () => {
  it("given a product with sizes > then every size's row carries its value", async () => {
    const { raw, db } = setup();
    await oringWithSizes(raw, db);
    const token = await signedIn(raw, db, "super_admin");
    const res = await call(db, token, "GET", "/stock");
    expect(res.status).toBe(200);
    const rows = (
      (await res.json()) as {
        stock: { choiceValue: string | null; choiceCode: string | null; onHand: number }[];
      }
    ).stock;
    expect(rows.map((r) => [r.choiceValue, r.choiceCode, r.onHand]).sort()).toEqual([
      ["1/2 กลาง", "TG949142-00204D", 7],
      ["3/8 เล็ก", "TG949142-00104D", 100],
      ["5/8 ใหญ่", "TG949142-00304D", 0],
    ]);
  });
});
