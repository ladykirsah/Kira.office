/**
 * Board 2 (ค้นหา · หมวดหมู่) on the phone, owner-approved 5 Nov 2026 — the words and rules behind the
 * search results, the sort bar, the my-car filter and ตัวกรอง. No screen code here.
 */
export type SortKey = "relevant" | "best" | "new" | "price_asc" | "price_desc";

const SORTS: readonly SortKey[] = ["relevant", "best", "new", "price_asc", "price_desc"];

/** The `sort` url value → a known sort; anything else is เกี่ยวข้อง. */
export function parseSort(raw: string | undefined): SortKey {
  return SORTS.find((s) => s === raw) ?? "relevant";
}

/** 2.2 sort bar: เกี่ยวข้อง · ขายดี · ใหม่ · ราคา. Tapping ราคา flips low→high / high→low. */
export function sortTabs(current: SortKey): { label: string; sort: SortKey; on: boolean }[] {
  const priceOn = current === "price_asc" || current === "price_desc";
  return [
    { label: "เกี่ยวข้อง", sort: "relevant", on: current === "relevant" },
    { label: "ขายดี", sort: "best", on: current === "best" },
    { label: "ใหม่", sort: "new", on: current === "new" },
    { label: "ราคา", sort: current === "price_asc" ? "price_desc" : "price_asc", on: priceOn },
  ];
}

/** The red number on ตัวกรอง: one for each thing narrowing the list (my car · category · brand). */
export function activeFilterCount(f: { carOn: boolean; type?: string; brand?: string }): number {
  return (f.carOn ? 1 : 0) + (f.type ? 1 : 0) + (f.brand ? 1 : 0);
}

/** My car filters the list unless the shopper tapped × (`car=off` in the url). */
export function carOnFrom(raw: string | undefined): boolean {
  return raw !== "off";
}

/** The my-car filter: only the parts that fit (ids from /api/fits), in the list's own order. */
export function filterByCar<T extends { variantId: string }>(
  items: T[],
  fitIds: ReadonlySet<string>,
  carOn: boolean,
): T[] {
  return carOn ? items.filter((i) => fitIds.has(i.variantId)) : items;
}

/** The grey count line above the results. */
export function resultLine(a: { shown: number; total: number; carFiltered: boolean }): string {
  return a.carFiltered
    ? `ใส่ได้กับรถของคุณ ${a.shown} จาก ${a.total} รายการ`
    : `พบ ${a.total} รายการ`;
}

/** /products url from the current params with some changed; an undefined or empty value drops it. */
export function browseHref(
  base: Record<string, string | undefined>,
  over: Record<string, string | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/products?${qs}` : "/products";
}

/** Most stocked first (so the chips and lists lead with what the shop has); ties keep the order. */
export function byMostStocked<T extends { productCount: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.productCount - a.productCount);
}

/** search = 2.2 · cat = 2.9 (one category) · brand = one car brand · sale = flash deals */
export type BrowseMode = "search" | "cat" | "brand" | "sale";

/**
 * ✓ on ตัวกรอง → what changes in the url. On a category page the car-brand chips belong to that category,
 * so picking another category drops the chosen chip (else the new category could show nothing with no
 * chip left to tap); going back to ทั้งหมด leaves the category page. A car-brand page keeps its brand.
 */
export function filterApply(
  mode: BrowseMode,
  params: Record<string, string | undefined>,
  next: { carOn: boolean; type?: string; brand?: string },
): Record<string, string | undefined> {
  const over: Record<string, string | undefined> = {
    type: next.type,
    brand: next.brand,
    car: next.carOn ? undefined : "off",
    ctx: mode === "cat" && !next.type ? undefined : params.ctx,
  };
  if (mode !== "cat" || next.type === params.type) return over;
  return { ...over, carBrand: undefined, carModel: undefined, year: undefined };
}
