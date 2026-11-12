/**
 * ตัวเลือกสินค้า (sizes, brands, packs) and กลุ่มสินค้า (groups) on หน้าสินค้า — drawn and approved
 * 7 Nov 2026 (canvas board ChoicesGroup, migration 0101).
 *
 * A CHOICE is a product_variants row: its own code (barcode_primary, also a barcodes row so it can
 * be scanned), prices (pricing_profiles) and stock (stock_ledger_entries). option_1_name holds the
 * option's name ("ขนาด") and option_1_value the choice ("3/8 เล็ก"). The first time choices are set
 * up, the product's existing variant becomes the first choice and keeps its code, price and stock:
 * *"3/8 เล็ก = สินค้านี้ · รหัส ราคา และสต็อกที่มีอยู่ เป็นของ 3/8 เล็ก"*.
 *
 * A GROUP is a set of products that stand in for each other; each keeps its own page. Products that
 * share products.group_id list each other. A group never holds fewer than two.
 *
 * Only D1 here; R2 (the choice's photo) stays in the route, like the gallery's.
 */

export interface ChoicePricing {
  itemCostSatang: number;
  targetPriceSatang: number;
  onlinePriceSatang: number;
  shopeePriceSatang: number;
  b2bPriceSatang: number;
  onlineCommissionBp: number;
  taxOnCost: number;
}

export interface Choice {
  variantId: string;
  value: string;
  /** The choice's own code, which its label prints and Scan reads; null until someone types one. */
  code: string | null;
  /** Its one photo; null until one is added (the product's first photo stands in). */
  imageKey: string | null;
  onHand: number;
  held: number;
  /** Sold, counted or moved already — then it can never be removed (no 🗑). */
  inUse: boolean;
  pricing: ChoicePricing | null;
}

export interface ProductChoices {
  optionName: string | null;
  choices: Choice[];
}

export interface ChoicePriceInput {
  itemCostSatang: number;
  targetPriceSatang: number;
  onlinePriceSatang: number;
  shopeePriceSatang: number;
  b2bPriceSatang: number;
  onlineCommissionBp: number;
  taxOnCost: boolean;
}

export interface ChoiceInput {
  value: string;
  code: string;
  pricing: ChoicePriceInput;
}

export type ChoiceRefusal =
  | "not_found"
  | "has_choices"
  | "no_choices"
  | "name_missing"
  | "value_missing"
  | "value_taken"
  | "code_missing"
  | "code_taken"
  | "in_use"
  | "last_choice";

export type ChoiceResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; reason: ChoiceRefusal };

export interface GroupMember {
  id: string;
  /** The full name, for search; rows show [type] [brand] from the parts below. */
  name: string;
  productRef: string;
  typeName: string | null;
  typeNameTh: string | null;
  brandName: string | null;
  imageKey: string | null;
  /** ขายได้ across all of its choices. */
  onHand: number;
  /** ราคาลูกค้า (the เด่นแอร์ price) of its cheapest choice — "เริ่ม ฿" when it has sizes. */
  priceSatang: number;
  /** How many choices (sizes) it has; 1 for a product without sizes. */
  choiceCount: number;
}

const refuse = (reason: ChoiceRefusal): { ok: false; reason: ChoiceRefusal } => ({
  ok: false,
  reason,
});

const clean = (s: string | null | undefined): string => (s ?? "").trim();

async function productExists(db: D1Database, productId: string): Promise<boolean> {
  return !!(await db.prepare("SELECT 1 AS x FROM products WHERE id = ?").bind(productId).first());
}

interface VariantRow {
  id: string;
  value: string | null;
  optionName: string | null;
  code: string | null;
  imageKey: string | null;
  createdAt: number;
}

/** A new choice's time: after every existing one, so choices read back in the order they were made. */
const nextTime = (rows: readonly VariantRow[]): number =>
  Math.max(Date.now(), ...rows.map((r) => Number(r.createdAt) + 1));

async function variantsOf(db: D1Database, productId: string): Promise<VariantRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, option_1_value AS value, option_1_name AS optionName,
              barcode_primary AS code, image_key AS imageKey, created_at AS createdAt
         FROM product_variants WHERE product_id = ? ORDER BY created_at, id`,
    )
    .bind(productId)
    .all<VariantRow>();
  return results;
}

/** A product has choices once its variants carry a value. */
const choiceRows = (rows: readonly VariantRow[]) => rows.filter((r) => clean(r.value) !== "");

/** Sold, counted, held or moved: anything the books or the audit trail depend on. */
async function variantInUse(db: D1Database, variantId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM sales_order_lines WHERE product_variant_id = ?1)
            + (SELECT COUNT(*) FROM onsite_sale_lines WHERE product_variant_id = ?1)
            + (SELECT COUNT(*) FROM stock_ledger_entries WHERE product_variant_id = ?1) AS n`,
    )
    .bind(variantId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0) > 0;
}

async function stockOf(
  db: D1Database,
  variantId: string,
): Promise<{ onHand: number; held: number }> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(quantity_delta), 0) AS onHand,
              COALESCE(SUM(CASE WHEN movement_type IN ('hold', 'unhold') THEN quantity_delta END), 0) AS holds
         FROM stock_ledger_entries WHERE product_variant_id = ?`,
    )
    .bind(variantId)
    .first<{ onHand: number; holds: number }>();
  // Held deltas are negative in the ledger (see readHeldForVariant); +0, never -0.
  const holds = Number(row?.holds ?? 0);
  return { onHand: Number(row?.onHand ?? 0), held: holds === 0 ? 0 : -holds };
}

async function pricingOf(db: D1Database, variantId: string): Promise<ChoicePricing | null> {
  return (
    (await db
      .prepare(
        `SELECT item_cost_satang AS itemCostSatang, target_price_satang AS targetPriceSatang,
                online_price_satang AS onlinePriceSatang, shopee_price_satang AS shopeePriceSatang,
                b2b_price_satang AS b2bPriceSatang, online_commission_bp AS onlineCommissionBp,
                tax_on_cost AS taxOnCost
           FROM pricing_profiles WHERE product_variant_id = ? ORDER BY active_from DESC LIMIT 1`,
      )
      .bind(variantId)
      .first<ChoicePricing>()) ?? null
  );
}

/** The product's choices in the order they were made, each with its code, stock and prices. */
export async function readChoices(db: D1Database, productId: string): Promise<ProductChoices> {
  const rows = choiceRows(await variantsOf(db, productId));
  if (rows.length === 0) return { optionName: null, choices: [] };
  const choices: Choice[] = [];
  for (const r of rows) {
    const stock = await stockOf(db, r.id);
    choices.push({
      variantId: r.id,
      value: clean(r.value),
      code: clean(r.code) || null,
      imageKey: r.imageKey ?? null,
      onHand: stock.onHand,
      held: stock.held,
      inUse: await variantInUse(db, r.id),
      pricing: await pricingOf(db, r.id),
    });
  }
  return { optionName: clean(rows[0]!.optionName) || null, choices };
}

/** Trimmed values; a refusal when one is empty or two are the same. */
function cleanValues(values: readonly string[]): string[] | ChoiceRefusal {
  const out = values.map(clean);
  if (out.length === 0 || out.some((v) => !v)) return "value_missing";
  if (new Set(out).size !== out.length) return "value_taken";
  return out;
}

/**
 * The first เพิ่มตัวเลือก sheet: the option's name and its values. The product's existing variant
 * becomes the first value (keeping its code, prices and stock); each other value is a new, empty one.
 */
export async function setUpChoices(
  db: D1Database,
  productId: string,
  name: string,
  values: readonly string[],
): Promise<ChoiceResult> {
  if (!(await productExists(db, productId))) return refuse("not_found");
  const optionName = clean(name);
  if (!optionName) return refuse("name_missing");
  const list = cleanValues(values);
  if (typeof list === "string") return refuse(list);
  const variants = await variantsOf(db, productId);
  if (choiceRows(variants).length > 0) return refuse("has_choices");
  const first = variants[0];
  if (!first) return refuse("not_found");
  const now = nextTime(variants);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare("UPDATE product_variants SET option_1_name = ?, option_1_value = ? WHERE id = ?")
      .bind(optionName, list[0]!, first.id),
  ];
  list.slice(1).forEach((value, i) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO product_variants (id, product_id, status, created_at, option_1_name, option_1_value)
           VALUES (?, ?, 'active', ?, ?, ?)`,
        )
        // One millisecond apart, so they read back in the order they were typed.
        .bind(crypto.randomUUID(), productId, now + i, optionName, value),
    );
  });
  await db.batch(stmts);
  return { ok: true };
}

/** ชื่อกลุ่ม: the option's name, on every choice. */
export async function renameOption(
  db: D1Database,
  productId: string,
  name: string,
): Promise<ChoiceResult> {
  const optionName = clean(name);
  if (!optionName) return refuse("name_missing");
  if (choiceRows(await variantsOf(db, productId)).length === 0) return refuse("no_choices");
  await db
    .prepare(
      `UPDATE product_variants SET option_1_name = ?
        WHERE product_id = ? AND TRIM(COALESCE(option_1_value, '')) <> ''`,
    )
    .bind(optionName, productId)
    .run();
  return { ok: true };
}

/** Is this code someone else's — another variant's barcode, or another product's code? */
async function codeTaken(
  db: D1Database,
  code: string,
  productId: string,
  variantId: string | null,
): Promise<boolean> {
  const barcode = await db
    .prepare(
      `SELECT 1 AS x FROM barcodes WHERE barcode_value = ? COLLATE NOCASE
          AND product_variant_id <> COALESCE(?, '') LIMIT 1`,
    )
    .bind(code, variantId)
    .first();
  if (barcode) return true;
  const ref = await db
    .prepare(`SELECT 1 AS x FROM products WHERE product_ref = ? COLLATE NOCASE AND id <> ? LIMIT 1`)
    .bind(code, productId)
    .first();
  if (ref) return true;
  // The product's own code belongs to its first choice; another choice of it may not take it.
  if (variantId === null) {
    const own = await db
      .prepare(`SELECT 1 AS x FROM products WHERE id = ? AND product_ref = ? COLLATE NOCASE`)
      .bind(productId, code)
      .first();
    return !!own;
  }
  return false;
}

function pricingStatements(db: D1Database, variantId: string, p: ChoicePriceInput, now: number) {
  return [
    db.prepare("DELETE FROM pricing_profiles WHERE product_variant_id = ?").bind(variantId),
    db
      .prepare(
        `INSERT INTO pricing_profiles (id, product_variant_id, item_cost_satang, target_price_satang,
           online_price_satang, shopee_price_satang, b2b_price_satang, online_commission_bp, tax_on_cost, active_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        variantId,
        p.itemCostSatang,
        p.targetPriceSatang,
        p.onlinePriceSatang,
        p.shopeePriceSatang,
        p.b2bPriceSatang,
        p.onlineCommissionBp,
        p.taxOnCost ? 1 : 0,
        now,
      ),
  ];
}

/** The code as the variant's barcode: the old ones go, the new one is the only one it answers to. */
function codeStatements(db: D1Database, variantId: string, code: string, now: number) {
  return [
    db
      .prepare("UPDATE product_variants SET barcode_primary = ?, sku = ? WHERE id = ?")
      .bind(code, code, variantId),
    db.prepare("DELETE FROM barcodes WHERE product_variant_id = ?").bind(variantId),
    db
      .prepare(
        `INSERT INTO barcodes (id, product_variant_id, barcode_value, is_primary, is_internal_generated, created_at)
         VALUES (?, ?, ?, 1, 0, ?)`,
      )
      .bind(crypto.randomUUID(), variantId, code, now),
  ];
}

async function checkInput(
  db: D1Database,
  productId: string,
  variantId: string | null,
  input: ChoiceInput,
  rows: readonly VariantRow[],
): Promise<{ value: string; code: string } | ChoiceRefusal> {
  const value = clean(input.value);
  if (!value) return "value_missing";
  const code = clean(input.code);
  if (!code) return "code_missing";
  if (rows.some((r) => r.id !== variantId && clean(r.value) === value)) return "value_taken";
  if (await codeTaken(db, code, productId, variantId)) return "code_taken";
  return { value, code };
}

/** + เพิ่มตัวเลือก once choices exist: a new choice with its code and prices, and no stock yet. */
export async function addChoice(
  db: D1Database,
  productId: string,
  input: ChoiceInput,
): Promise<ChoiceResult<{ variantId: string }>> {
  if (!(await productExists(db, productId))) return refuse("not_found");
  const rows = choiceRows(await variantsOf(db, productId));
  if (rows.length === 0) return refuse("no_choices");
  const checked = await checkInput(db, productId, null, input, rows);
  if (typeof checked === "string") return refuse(checked);
  const variantId = crypto.randomUUID();
  const now = nextTime(rows);
  await db.batch([
    db
      .prepare(
        `INSERT INTO product_variants (id, product_id, status, created_at, option_1_name, option_1_value)
         VALUES (?, ?, 'active', ?, ?, ?)`,
      )
      .bind(variantId, productId, now, clean(rows[0]!.optionName) || null, checked.value),
    ...codeStatements(db, variantId, checked.code, now),
    ...pricingStatements(db, variantId, input.pricing, now),
  ]);
  return { ok: true, variantId };
}

/** แก้ไขตัวเลือก: its value, code and prices. Stock moves through the ledger, like a product's. */
export async function updateChoice(
  db: D1Database,
  productId: string,
  variantId: string,
  input: ChoiceInput,
): Promise<ChoiceResult> {
  const rows = choiceRows(await variantsOf(db, productId));
  const row = rows.find((r) => r.id === variantId);
  if (!row) return refuse("not_found");
  const checked = await checkInput(db, productId, variantId, input, rows);
  if (typeof checked === "string") return refuse(checked);
  const now = Date.now();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare("UPDATE product_variants SET option_1_value = ? WHERE id = ?")
      .bind(checked.value, variantId),
    ...pricingStatements(db, variantId, input.pricing, now),
  ];
  if (clean(row.code) !== checked.code)
    stmts.push(...codeStatements(db, variantId, checked.code, now));
  await db.batch(stmts);
  return { ok: true };
}

/**
 * 🗑 / เอาตัวเลือกนี้ออก. A choice that was ever sold, counted or held stays (the books name it);
 * the last one stays too, since a product always has one.
 */
export async function removeChoice(
  db: D1Database,
  productId: string,
  variantId: string,
): Promise<ChoiceResult> {
  const rows = choiceRows(await variantsOf(db, productId));
  if (!rows.some((r) => r.id === variantId)) return refuse("not_found");
  if (await variantInUse(db, variantId)) return refuse("in_use");
  if (rows.length <= 1) return refuse("last_choice");
  await db.batch([
    db.prepare("DELETE FROM campaign_prices WHERE product_variant_id = ?").bind(variantId),
    db.prepare("DELETE FROM pricing_profiles WHERE product_variant_id = ?").bind(variantId),
    db.prepare("DELETE FROM barcodes WHERE product_variant_id = ?").bind(variantId),
    db.prepare("DELETE FROM product_variants WHERE id = ?").bind(variantId),
  ]);
  return { ok: true };
}

/** The choice's one photo, once the route has stored it. */
export async function setChoiceImage(
  db: D1Database,
  productId: string,
  variantId: string,
  imageKey: string,
): Promise<ChoiceResult> {
  const res = await db
    .prepare("UPDATE product_variants SET image_key = ? WHERE id = ? AND product_id = ?")
    .bind(imageKey, variantId, productId)
    .run();
  return Number(res.meta?.changes ?? (res as unknown as { changes?: number }).changes ?? 0) > 0
    ? { ok: true }
    : refuse("not_found");
}

async function groupIdOf(db: D1Database, productId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT group_id AS g FROM products WHERE id = ?")
    .bind(productId)
    .first<{ g: string | null }>();
  return row?.g ?? null;
}

/** Everyone in this product's group, itself included; [] when it is in none. */
export async function readGroup(db: D1Database, productId: string): Promise<GroupMember[]> {
  const groupId = await groupIdOf(db, productId);
  if (!groupId) return [];
  const { results } = await db
    .prepare(
      `SELECT p.id, p.name, p.product_ref AS productRef, t.name AS typeName, t.name_th AS typeNameTh,
              b.name AS brandName, p.image_key AS imageKey,
              (SELECT COALESCE(SUM(e.quantity_delta), 0) FROM stock_ledger_entries e
                 JOIN product_variants v ON v.id = e.product_variant_id
                WHERE v.product_id = p.id) AS onHand,
              COALESCE((SELECT MIN((SELECT pp.target_price_satang FROM pricing_profiles pp
                                     WHERE pp.product_variant_id = v.id
                                     ORDER BY pp.active_from DESC LIMIT 1))
                          FROM product_variants v WHERE v.product_id = p.id), 0) AS priceSatang,
              (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS choiceCount
         FROM products p
         LEFT JOIN product_types t ON t.id = p.type_id
         LEFT JOIN brands b ON b.id = p.brand_id
        WHERE p.group_id = ?
        ORDER BY p.created_at, p.id`,
    )
    .bind(groupId)
    .all<GroupMember>();
  return results.map((m) => ({
    ...m,
    onHand: Number(m.onHand),
    priceSatang: Number(m.priceSatang),
    choiceCount: Number(m.choiceCount),
  }));
}

/**
 * + เพิ่มสินค้าในกลุ่ม: the picked products join this product's group (made now if it has none).
 * A picked product already in another group brings that whole group along — they stand in for
 * each other too, so the two groups become one.
 */
export async function addToGroup(
  db: D1Database,
  productId: string,
  otherIds: readonly string[],
): Promise<ChoiceResult> {
  const ids = [...new Set(otherIds.map(clean).filter((id) => id && id !== productId))];
  if (ids.length === 0 || !(await productExists(db, productId))) return refuse("not_found");
  for (const id of ids) {
    if (!(await productExists(db, id))) return refuse("not_found");
  }
  const groupId = (await groupIdOf(db, productId)) ?? crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [
    db.prepare("UPDATE products SET group_id = ? WHERE id = ?").bind(groupId, productId),
  ];
  for (const id of ids) {
    const theirs = await groupIdOf(db, id);
    if (theirs && theirs !== groupId) {
      stmts.push(
        db.prepare("UPDATE products SET group_id = ? WHERE group_id = ?").bind(groupId, theirs),
      );
    }
    stmts.push(db.prepare("UPDATE products SET group_id = ? WHERE id = ?").bind(groupId, id));
  }
  await db.batch(stmts);
  return { ok: true };
}

/** 🗑 in the group sheet: the member leaves the group (the product stays). A group of one ends. */
export async function removeFromGroup(
  db: D1Database,
  productId: string,
  memberId: string,
): Promise<ChoiceResult> {
  const groupId = await groupIdOf(db, productId);
  if (!groupId || (await groupIdOf(db, memberId)) !== groupId) return refuse("not_found");
  await db.prepare("UPDATE products SET group_id = NULL WHERE id = ?").bind(memberId).run();
  const left = await db
    .prepare("SELECT COUNT(*) AS n FROM products WHERE group_id = ?")
    .bind(groupId)
    .first<{ n: number }>();
  if (Number(left?.n ?? 0) < 2) {
    await db.prepare("UPDATE products SET group_id = NULL WHERE group_id = ?").bind(groupId).run();
  }
  return { ok: true };
}
