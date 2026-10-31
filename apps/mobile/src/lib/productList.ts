import type { Phrase } from "@l-shopee/shared/lang";

/**
 * The rules behind สินค้า's list (owner asked to build the drawing, canvas v194, 31 Oct 2026): five
 * tabs with counts, one search, three filters and a sort, all worked out on the phone — the server
 * sends the whole catalogue in one list (GET /products). No screen code here.
 */

/** One car a part fits, as the product keeps it: names, not ids, and an optional year span. */
export interface Fitment {
  carBrand: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

/** One row of GET /products. Brand, system and part name are the attribute's identity `name`. */
export interface ProductRow {
  id: string;
  variantId: string;
  productRef: string;
  name: string;
  /** active = on AirPlus; draft and paused are not live. */
  status: string;
  imageKey: string | null;
  shopeeListed: number;
  updatedAt: number | null;
  brandName: string | null;
  typeName: string | null;
  usageName: string | null;
  /** The เด่นแอร์ counter price. */
  offlinePriceSatang: number;
  onlinePriceSatang: number;
  b2bPriceSatang: number;
  /** 0 for anyone who may not see cost. */
  itemCostSatang: number;
  onlineCommissionBp: number;
  taxOnCost: number;
  /** ขายได้ — what can be sold; stock out on jobs is already left out. */
  onHand: number;
  /** งานนอก — out on outside jobs. */
  held: number;
  fitments: Fitment[];
}

export type ProductTab = "all" | "airplus" | "notLive" | "low" | "out";
export type ProductSort = "updated" | "name" | "price" | "low";
export type StockLevel = "ok" | "low" | "out";

export interface ProductFilters {
  brand: string | null;
  usage: string | null;
  type: string | null;
  car: Fitment | null;
}

export const NO_FILTERS: ProductFilters = { brand: null, usage: null, type: null, car: null };

/** The shop's one low-stock line, the same as the web back office (apps/admin/src/lib/stock.ts). */
const LOW_STOCK = 3;

export const PRODUCT_TABS: readonly { key: ProductTab; label: Phrase }[] = [
  { key: "all", label: { th: "ทั้งหมด", en: "All" } },
  { key: "airplus", label: { th: "บน AirPlus", en: "On AirPlus" } },
  { key: "notLive", label: { th: "ยังไม่วางขาย", en: "Not on sale" } },
  { key: "low", label: { th: "เหลือน้อย", en: "Low" } },
  { key: "out", label: { th: "หมด", en: "Sold out" } },
];

export const PRODUCT_SORTS: readonly { key: ProductSort; label: Phrase }[] = [
  { key: "updated", label: { th: "แก้ไขล่าสุด", en: "Last edited" } },
  { key: "name", label: { th: "ชื่อ ก–ฮ", en: "Name A–Z" } },
  { key: "price", label: { th: "ราคาต่ำ–สูง", en: "Price low–high" } },
  { key: "low", label: { th: "เหลือน้อยก่อน", en: "Lowest stock first" } },
];

export function stockLevel(forSale: number): StockLevel {
  if (forSale <= 0) return "out";
  return forSale <= LOW_STOCK ? "low" : "ok";
}

const inTab: Record<ProductTab, (r: ProductRow) => boolean> = {
  all: () => true,
  airplus: (r) => r.status === "active",
  notLive: (r) => r.status !== "active",
  low: (r) => stockLevel(r.onHand) === "low",
  out: (r) => stockLevel(r.onHand) === "out",
};

/** Each tab counts the whole catalogue, whatever is typed or picked (as drawn). */
export function tabCounts(rows: readonly ProductRow[]): Record<ProductTab, number> {
  const count = (tab: ProductTab) => rows.filter(inTab[tab]).length;
  return {
    all: count("all"),
    airplus: count("airplus"),
    notLive: count("notLive"),
    low: count("low"),
    out: count("out"),
  };
}

/** A match is a result: the typed text inside the name or the code, nothing fuzzier. */
export function matchesSearch(row: ProductRow, q: string): boolean {
  const typed = q.trim().toLowerCase();
  if (!typed) return true;
  return row.name.toLowerCase().includes(typed) || row.productRef.toLowerCase().includes(typed);
}

const carKey = (f: Fitment) => [f.carBrand, f.carModel, f.yearFrom, f.yearTo].join("|");

export function hasFilters(f: ProductFilters): boolean {
  return f.brand != null || f.usage != null || f.type != null || f.car != null;
}

function passes(row: ProductRow, f: ProductFilters): boolean {
  if (f.brand != null && row.brandName !== f.brand) return false;
  if (f.usage != null && row.usageName !== f.usage) return false;
  if (f.type != null && row.typeName !== f.type) return false;
  if (f.car != null && !row.fitments.some((x) => carKey(x) === carKey(f.car!))) return false;
  return true;
}

const ORDER: Record<ProductSort, (a: ProductRow, b: ProductRow) => number> = {
  // Never-edited rows go last; the server's own order (newest first) breaks ties.
  updated: (a, b) => (b.updatedAt ?? -1) - (a.updatedAt ?? -1),
  name: (a, b) => a.name.localeCompare(b.name, "th"),
  price: (a, b) => a.offlinePriceSatang - b.offlinePriceSatang,
  low: (a, b) => a.onHand - b.onHand,
};

export function visibleRows(
  rows: readonly ProductRow[],
  view: { tab: ProductTab; q: string; filters: ProductFilters; sort: ProductSort },
): ProductRow[] {
  return rows
    .filter((r) => inTab[view.tab](r) && matchesSearch(r, view.q) && passes(r, view.filters))
    .sort(ORDER[view.sort]);
}

/** The grey line under the title: the catalogue, or how many a search or filter found. */
export function listSubtitle(
  rows: readonly ProductRow[],
  shown: number,
  q: string,
  filters: ProductFilters,
): Phrase {
  if (q.trim()) return { th: `พบ ${shown} รายการ`, en: `${shown} found` };
  if (hasFilters(filters)) {
    return { th: `พบ ${shown} รายการ จาก ${rows.length}`, en: `${shown} of ${rows.length}` };
  }
  const forSale = rows.filter((r) => r.onHand > 0).length;
  return {
    th: `${rows.length} รายการ · ขายได้ ${forSale}`,
    en: `${rows.length} products · ${forSale} for sale`,
  };
}

/** The card's grey line: how many are left, then where it is sold. The dot comes from `level`. */
export function stockLine(row: ProductRow): { level: StockLevel; text: Phrase } {
  const level = stockLevel(row.onHand);
  const count: Phrase =
    level === "out"
      ? { th: "หมด", en: "Sold out" }
      : level === "low"
        ? { th: `เหลือน้อย ${row.onHand}`, en: `Low ${row.onHand}` }
        : { th: `เหลือ ${row.onHand}`, en: `${row.onHand} left` };
  const channels = [row.status === "active" ? "AirPlus" : null, row.shopeeListed ? "Shopee" : null]
    .filter(Boolean)
    .map((c) => ` · ${c}`)
    .join("");
  return { level, text: { th: count.th + channels, en: count.en + channels } };
}

/** The values a filter can take, each with how many rows have it, most first. */
export function countBy(
  rows: readonly ProductRow[],
  key: (r: ProductRow) => string | null,
): { value: string; count: number }[] {
  return countByMany(rows, (r) => [key(r)]);
}

/** Car brands, each counted once per row that fits any of its models. */
export function carOptions(rows: readonly ProductRow[]): { value: string; count: number }[] {
  return countByMany(rows, (r) => r.fitments.map((f) => f.carBrand));
}

/** One brand's models with their years, each counted once per row. */
export function carModelOptions(
  rows: readonly ProductRow[],
  brand: string,
): { car: Fitment; count: number }[] {
  const seen = new Map<string, { car: Fitment; count: number }>();
  for (const r of rows) {
    const mine = new Map(
      r.fitments.filter((f) => f.carBrand === brand && f.carModel).map((f) => [carKey(f), f]),
    );
    for (const [k, car] of mine) {
      const hit = seen.get(k);
      seen.set(k, { car: hit?.car ?? car, count: (hit?.count ?? 0) + 1 });
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

function countByMany(
  rows: readonly ProductRow[],
  keys: (r: ProductRow) => (string | null)[],
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const v of new Set(keys(r))) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/** "2005–2014", "2014–" (still made), or "" when the car has no years. */
export function yearRange(from: number | null, to: number | null): string {
  if (from == null && to == null) return "";
  return `${from ?? ""}–${to ?? ""}`;
}
