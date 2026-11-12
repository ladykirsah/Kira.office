import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { D1Database } from "@cloudflare/workers-types";
import { bestSellers, getProduct, listCatalog } from "./db";
import { accountOrderLines, trackingOrderLines } from "./orderLines";
import { addToCart } from "./cart";

/**
 * ตัวเลือกสินค้า (sizes) on the AirPlus storefront: a product with several product_variants rows is
 * listed ONCE, represented by its cheapest in-stock size. Every test runs against a real sqlite
 * built from the real migrations.
 */

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/migrations",
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

/** The slice of D1 the storefront reads use. */
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
    };
    return stmt;
  };
  return { prepare: (sql: string) => make(sql) } as unknown as D1Database;
}

const NOW = Date.now();

function setup() {
  const raw = migrated();
  return { raw, db: asD1(raw) };
}

/** A product row, filed under seeded reference data (Evaporator, DENSO). */
function addProduct(raw: DatabaseSync, id: string) {
  raw
    .prepare(
      `INSERT INTO products (id, product_ref, name, status, created_at, type_id, brand_id, image_key)
       VALUES (?, ?, ?, 'active', ?, 'pt-evaporator', 'br-denso', ?)`,
    )
    .run(id, `REF-${id}`, `ตู้แอร์ ${id}`, NOW, `products/${id}/cover.jpg`);
}

interface VariantSeed {
  id: string;
  product: string;
  /** created_at — the back office orders choices by it */
  at?: number;
  /** option_1_value; omitted = a normal product's only variant */
  value?: string;
  /** latest online price in satang; null = no pricing row */
  price?: number | null;
  stock?: number;
}

/** A variant with its own code, price and stock, the way the back office saves a choice. */
function addVariant(raw: DatabaseSync, s: VariantSeed) {
  raw
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, barcode_primary, status, created_at,
         option_1_name, option_1_value)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(
      s.id,
      s.product,
      `SKU-${s.id}`,
      `BC-${s.id}`,
      s.at ?? NOW,
      s.value ? "ขนาด" : null,
      s.value ?? null,
    );
  const price = s.price === undefined ? 3000 : s.price;
  if (price !== null) {
    raw
      .prepare(
        `INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, target_price_satang,
           online_price_satang, shopee_price_satang, b2b_price_satang, online_commission_bp, tax_on_cost, active_from)
         VALUES (?, ?, 1200, ?, ?, ?, 2500, 0, 0, ?)`,
      )
      .run(`${s.id}-pp`, s.id, price, price, price, NOW);
  }
  if (s.stock) {
    raw
      .prepare(
        `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, created_at)
         VALUES (?, ?, 'manual_adjustment', ?, ?, ?)`,
      )
      .run(`${s.id}-in`, s.id, s.stock, s.stock, NOW);
  }
}

const HOUR = 60 * 60 * 1000;

/** An active แฟลชเซล running now, pricing one variant. */
function addFlashPrice(raw: DatabaseSync, variantId: string, priceSatang: number) {
  const campaignId = `cg-${variantId}`;
  raw
    .prepare(
      `INSERT INTO campaigns (id, name, starts_at, ends_at, status, created_at)
       VALUES (?, 'แฟลชเซล', ?, ?, 'active', ?)`,
    )
    .run(campaignId, NOW - HOUR, NOW + HOUR, NOW);
  raw
    .prepare(
      `INSERT INTO campaign_prices (id, campaign_id, product_variant_id, campaign_price_satang,
         stock_cap, sold_count, created_at)
       VALUES (?, ?, ?, ?, NULL, 0, ?)`,
    )
    .run(`cp-${variantId}`, campaignId, variantId, priceSatang, NOW);
}

const DAY = 24 * HOUR;

/** An AirPlus order placed yesterday for `qty` of one variant; returns the order id. */
function sell(raw: DatabaseSync, variantId: string, qty: number): string {
  const orderId = `o-${variantId}-${qty}`;
  raw
    .prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_created_at, imported_at)
       VALUES (?, 'airplus', ?, ?, ?)`,
    )
    .run(orderId, `AP-${orderId}`, NOW - DAY, NOW);
  raw
    .prepare(
      `INSERT INTO sales_order_lines (id, sales_order_id, product_variant_id, quantity,
         unit_price_satang, line_total_satang, created_at)
       VALUES (?, ?, ?, ?, 3000, ?, ?)`,
    )
    .run(`${orderId}-l1`, orderId, variantId, qty, 3000 * qty, NOW);
  return orderId;
}

/** A normal product: one variant, no option value. */
function addNormalProduct(raw: DatabaseSync, id: string, price = 3000, stock = 5) {
  addProduct(raw, id);
  addVariant(raw, { id: `${id}-v1`, product: id, price, stock });
}

/** An O-ring with two sizes; the dearer one was made first so creation order never decides. */
function addTwoSizeProduct(
  raw: DatabaseSync,
  id: string,
  sizes: { small?: Partial<VariantSeed>; medium?: Partial<VariantSeed> } = {},
) {
  addProduct(raw, id);
  addVariant(raw, {
    id: `${id}-small`,
    product: id,
    at: NOW,
    value: "3/8 เล็ก",
    price: 4000,
    stock: 3,
    ...sizes.small,
  });
  addVariant(raw, {
    id: `${id}-medium`,
    product: id,
    at: NOW + 1,
    value: "1/2 กลาง",
    price: 3000,
    stock: 3,
    ...sizes.medium,
  });
}

describe("listCatalog > choices", () => {
  it("given a normal one-variant product > then its row is the same as before", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp", 3500, 5);
    const rows = await listCatalog(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productId: "comp",
      variantId: "comp-v1",
      name: "ตู้แอร์ comp",
      productRef: "REF-comp",
      brandName: "DENSO",
      typeName: "Evaporator",
      imageKey: "products/comp/cover.jpg",
      priceSatang: 3500,
      onHand: 5,
      fitmentShort: null,
      campaign: null,
    });
  });

  it("given a product with two sizes in stock > then it is listed once, as its cheaper size", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    const rows = await listCatalog(db);
    expect(rows.map((r) => [r.productId, r.variantId, r.priceSatang])).toEqual([
      ["oring", "oring-medium", 3000],
    ]);
  });

  it("given the cheaper size is sold out > then the size still in stock stands for the product", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring", { medium: { stock: 0 } });
    const rows = await listCatalog(db);
    expect(rows.map((r) => [r.variantId, r.priceSatang, r.onHand])).toEqual([
      ["oring-small", 4000, 3],
    ]);
  });

  it("given a live flash price makes the dearer size the cheapest to buy > then that size stands for the product", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    addFlashPrice(raw, "oring-small", 2500);
    const rows = await listCatalog(db);
    expect(rows.map((r) => [r.variantId, r.priceSatang, r.campaign?.campaignPriceSatang])).toEqual([
      ["oring-small", 4000, 2500],
    ]);
  });

  it("given a normal product and a two-size product > then choiceCount is 1 and 2, sold-out sizes counted", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp");
    addTwoSizeProduct(raw, "oring", { small: { stock: 0 } });
    const rows = await listCatalog(db, { sort: "new" });
    expect(rows.map((r) => [r.productId, r.choiceCount]).sort()).toEqual([
      ["comp", 1],
      ["oring", 2],
    ]);
  });

  it("given a two-size product and a normal one > then each row names the size it stands for, or none", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp");
    addTwoSizeProduct(raw, "oring");
    const rows = await listCatalog(db, { sort: "new" });
    expect(rows.map((r) => [r.productId, r.choiceValue]).sort()).toEqual([
      ["comp", null],
      ["oring", "1/2 กลาง"],
    ]);
  });

  it("given the ขายดี sort > then a product ranks by the units of all its sizes together", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp");
    addTwoSizeProduct(raw, "oring");
    sell(raw, "comp-v1", 5);
    sell(raw, "oring-small", 3);
    sell(raw, "oring-medium", 3);
    const rows = await listCatalog(db, { sort: "best" });
    expect(rows.map((r) => r.productId)).toEqual(["oring", "comp"]);
  });

  it("given a search word, a category and the ขายดี sort together > then the sized product still comes back once", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp");
    addTwoSizeProduct(raw, "oring");
    sell(raw, "oring-small", 2);
    const rows = await listCatalog(db, { q: "oring", typeId: "pt-evaporator", sort: "best" });
    expect(rows.map((r) => [r.productId, r.variantId])).toEqual([["oring", "oring-medium"]]);
  });
});

describe("bestSellers > choices", () => {
  it("given sales spread over two sizes > then the product is listed once, ranked and counted by all its sizes", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp");
    addTwoSizeProduct(raw, "oring");
    sell(raw, "comp-v1", 4);
    sell(raw, "oring-small", 3);
    sell(raw, "oring-medium", 3);
    const rows = await bestSellers(db, { days: 90, limit: 8 });
    expect(rows.map((r) => [r.productId, r.variantId, r.monthlySales])).toEqual([
      ["oring", "oring-medium", 2],
      ["comp", "comp-v1", 1],
    ]);
  });
});

describe("getProduct > choices", () => {
  it("given a normal product > then it opens as before and choices is its one variant, with no option", async () => {
    const { raw, db } = setup();
    addNormalProduct(raw, "comp", 3500, 5);
    const detail = await getProduct(db, "comp");
    expect(detail).toMatchObject({
      variantId: "comp-v1",
      priceSatang: 3500,
      onHand: 5,
      imageKey: "products/comp/cover.jpg",
      choiceCount: 1,
    });
    expect(detail?.choices).toEqual([
      {
        variantId: "comp-v1",
        optionName: null,
        value: null,
        code: "BC-comp-v1",
        imageKey: "products/comp/cover.jpg",
        priceSatang: 3500,
        onHand: 5,
        campaign: null,
      },
    ]);
  });

  it("given two sizes in stock > then the page opens on the cheaper size, every time", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    const detail = await getProduct(db, "oring");
    expect([detail?.variantId, detail?.priceSatang, detail?.choiceCount]).toEqual([
      "oring-medium",
      3000,
      2,
    ]);
  });

  it("given two sizes > then choices lists both in the order they were made, each with its own code and price", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    const detail = await getProduct(db, "oring");
    expect(
      detail?.choices?.map((c) => [c.variantId, c.optionName, c.value, c.code, c.priceSatang]),
    ).toEqual([
      ["oring-small", "ขนาด", "3/8 เล็ก", "BC-oring-small", 4000],
      ["oring-medium", "ขนาด", "1/2 กลาง", "BC-oring-medium", 3000],
    ]);
  });

  it("given one size sold out > then it is still a choice, with nothing on hand", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring", { small: { stock: 0 } });
    const detail = await getProduct(db, "oring");
    expect(detail?.choices?.map((c) => [c.variantId, c.onHand])).toEqual([
      ["oring-small", 0],
      ["oring-medium", 3],
    ]);
  });

  it("given a size sold past zero > then it shows nothing on hand, never a negative count", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    raw
      .prepare(
        `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, created_at)
         VALUES ('oring-small-out', 'oring-small', 'online_sale', -5, -2, ?)`,
      )
      .run(NOW);
    const detail = await getProduct(db, "oring");
    expect(detail?.choices?.find((c) => c.variantId === "oring-small")?.onHand).toBe(0);
  });

  it("given one size has its own photo > then it shows that photo and the other shows the product's", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    raw
      .prepare("UPDATE product_variants SET image_key = ? WHERE id = ?")
      .run("products/oring/small.jpg", "oring-small");
    const detail = await getProduct(db, "oring");
    expect(detail?.choices?.map((c) => [c.variantId, c.imageKey])).toEqual([
      ["oring-small", "products/oring/small.jpg"],
      ["oring-medium", "products/oring/cover.jpg"],
    ]);
  });

  it("given a live flash price on one size > then only that choice carries the campaign", async () => {
    const { raw, db } = setup();
    addTwoSizeProduct(raw, "oring");
    addFlashPrice(raw, "oring-small", 2500);
    const detail = await getProduct(db, "oring");
    expect(detail?.choices?.map((c) => [c.variantId, c.campaign])).toEqual([
      [
        "oring-small",
        {
          campaignPriceSatang: 2500,
          startsAt: NOW - HOUR,
          endsAt: NOW + HOUR,
          status: "active",
          stockCap: null,
          soldCount: 0,
        },
      ],
      ["oring-medium", null],
    ]);
  });
});

describe("order lines > choices", () => {
  /** A sized line (the small O-ring, with its own photo) and a normal product's line. */
  function orderedBoth(raw: DatabaseSync): string[] {
    addNormalProduct(raw, "comp");
    addTwoSizeProduct(raw, "oring");
    raw
      .prepare("UPDATE product_variants SET image_key = ? WHERE id = ?")
      .run("products/oring/small.jpg", "oring-small");
    return [sell(raw, "oring-small", 2), sell(raw, "comp-v1", 1)];
  }

  it("given my orders hold a sized line and a normal line > then each says its size (or none) and shows the size's photo", async () => {
    const { raw, db } = setup();
    const orderIds = orderedBoth(raw);
    const lines = await accountOrderLines(db, orderIds);
    expect(
      lines
        .map((l) => [l.variantId, l.choiceValue, l.imageKey])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ["comp-v1", null, "products/comp/cover.jpg"],
      ["oring-small", "3/8 เล็ก", "products/oring/small.jpg"],
    ]);
  });

  it("given a guest tracks an order > then a sized line says its size and shows its photo, a normal line says none", async () => {
    const { raw, db } = setup();
    const [sizedOrder, normalOrder] = orderedBoth(raw);
    const sized = await trackingOrderLines(db, sizedOrder!);
    const normal = await trackingOrderLines(db, normalOrder!);
    expect([...sized, ...normal].map((l) => [l.name, l.choiceValue, l.imageKey])).toEqual([
      ["ตู้แอร์ oring", "3/8 เล็ก", "products/oring/small.jpg"],
      ["ตู้แอร์ comp", null, "products/comp/cover.jpg"],
    ]);
  });
});

describe("cart > choices", () => {
  it("given a cart saved before sizes existed > then it still loads, and a sized line keeps its size label", () => {
    const KEY = "airplus.cart.v1";
    const oldLine = {
      variantId: "comp-v1",
      productId: "comp",
      name: "ตู้แอร์ comp",
      productRef: "REF-comp",
      priceSatang: 3000,
      imageKey: null,
      qty: 1,
    };
    const store = new Map<string, string>([[KEY, JSON.stringify([oldLine])]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      dispatchEvent: () => true,
    });
    try {
      addToCart({
        variantId: "oring-small",
        productId: "oring",
        name: "ตู้แอร์ oring",
        productRef: "REF-oring",
        priceSatang: 4000,
        imageKey: null,
        choiceLabel: "3/8 เล็ก",
      });
      const saved = JSON.parse(store.get(KEY) ?? "[]") as {
        variantId: string;
        choiceLabel?: string;
        qty: number;
      }[];
      expect(saved.map((l) => [l.variantId, l.choiceLabel, l.qty])).toEqual([
        ["comp-v1", undefined, 1],
        ["oring-small", "3/8 เล็ก", 1],
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("given the same size added twice and another size once > then the same size is one row, the other its own", () => {
    const KEY = "airplus.cart.v1";
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      dispatchEvent: () => true,
    });
    const line = (variantId: string, choiceLabel: string, priceSatang: number) => ({
      variantId,
      productId: "oring",
      name: "โอริง R134a DENSO",
      productRef: "REF-oring",
      priceSatang,
      imageKey: null,
      choiceLabel,
    });
    try {
      addToCart(line("oring-medium", "1/2 กลาง", 4000), 2);
      addToCart(line("oring-small", "3/8 เล็ก", 3000), 1);
      addToCart(line("oring-medium", "1/2 กลาง", 4000), 1);
      const saved = JSON.parse(store.get(KEY) ?? "[]") as {
        variantId: string;
        choiceLabel?: string;
        qty: number;
      }[];
      expect(saved.map((l) => [l.variantId, l.choiceLabel, l.qty])).toEqual([
        ["oring-medium", "1/2 กลาง", 3],
        ["oring-small", "3/8 เล็ก", 1],
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
