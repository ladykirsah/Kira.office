import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import { rangeLabel, shortDate, startOfDay } from "./orderList";
import { matchesSearch, type ProductRow } from "./productList";
import { attrLabel, type Named } from "./productPickers";

/**
 * The rules behind แบนเนอร์ (owner approved the drawing, canvas v245, 1 Nov 2026): the AirPlus home
 * page's main slides (3 places) and promo strips (any number), each with a picture, where a tap goes
 * (ไปที่) and when it shows. No screen code here; the server keeps the link as plain text, so ไปที่ is
 * worked out from it and back.
 */

export type BannerSlot = "hero" | "promo";

/** One row of GET /banners. */
export interface Banner {
  id: string;
  slot: string;
  imageKey: string | null;
  linkUrl: string | null;
  sortOrder: number;
  startsAt: number | null;
  endsAt: number | null;
  /** active or disabled (เปิดใช้ off). */
  status: string;
  createdAt: number;
}

/** The website's carousel takes 3 slides (owner's call, kept from the web back office). */
const SLOT_LIMIT: Record<BannerSlot, number | null> = { hero: 3, promo: null };

export function slotRows(banners: readonly Banner[], slot: BannerSlot): Banner[] {
  return banners
    .filter((b) => b.slot === slot)
    .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt);
}

/** `>=`: two phones adding at once can pass the limit, and then it must stay full. */
export function slotFull(slot: BannerSlot, count: number): boolean {
  const limit = SLOT_LIMIT[slot];
  return limit != null && count >= limit;
}

export function segmentLabel(slot: BannerSlot, count: number): Phrase {
  return slot === "hero"
    ? { th: `สไลด์หลัก · ${count} / 3`, en: `Main slides · ${count} / 3` }
    : { th: `แถบโปรโมชัน · ${count}`, en: `Promo strips · ${count}` };
}

export function rowName(slot: BannerSlot, index: number): Phrase {
  const n = index + 1;
  return slot === "hero"
    ? { th: `สไลด์ ${n}`, en: `Slide ${n}` }
    : { th: `แถบ ${n}`, en: `Strip ${n}` };
}

export function addTitle(slot: BannerSlot): Phrase {
  return slot === "hero"
    ? { th: "เพิ่มสไลด์", en: "Add a slide" }
    : { th: "เพิ่มแถบโปรโมชัน", en: "Add a promo strip" };
}

export const FULL_TOAST: Phrase = {
  th: "สไลด์หลักเต็มแล้ว · ลบอันเก่าก่อน",
  en: "The main slides are full · delete one first",
};

/** hidden = no picture: the website shows only banners that have one. */
export type BannerState = "showing" | "waiting" | "ended" | "off" | "hidden";

export const STATE_WORDS: Record<BannerState, Phrase> = {
  showing: { th: "แสดงอยู่", en: "Showing" },
  waiting: { th: "รอเริ่ม", en: "Starts later" },
  ended: { th: "หมดเวลาแล้ว", en: "Ended" },
  off: { th: "ปิดอยู่", en: "Off" },
  hidden: { th: "ไม่แสดง", en: "Not showing" },
};

/** The dot beside the words (the words stay grey). */
export const STATE_TONE: Record<BannerState, "success" | "waiting" | "muted"> = {
  showing: "success",
  waiting: "waiting",
  ended: "muted",
  off: "muted",
  hidden: "muted",
};

export function bannerState(b: Banner, now: number): BannerState {
  if (b.status !== "active") return "off";
  if (!b.imageKey) return "hidden";
  if (b.endsAt != null && b.endsAt < now) return "ended";
  if (b.startsAt != null && b.startsAt > now) return "waiting";
  return "showing";
}

export function windowLabel(startsAt: number | null, endsAt: number | null): Phrase {
  if (startsAt == null && endsAt == null) return { th: "ตลอดเวลา", en: "Always" };
  if (startsAt != null && endsAt != null) return rangeLabel({ from: startsAt, to: endsAt });
  if (startsAt != null) {
    const d = shortDate(startsAt);
    return { th: `ตั้งแต่ ${d.th}`, en: `From ${d.en}` };
  }
  const d = shortDate(endsAt!);
  return { th: `ถึง ${d.th}`, en: `Until ${d.en}` };
}

export function statusLine(b: Banner, now: number): Phrase {
  const state = STATE_WORDS[bannerState(b, now)];
  const when = windowLabel(b.startsAt, b.endsAt);
  return { th: `${state.th} · ${when.th}`, en: `${state.en} · ${when.en}` };
}

/** The list keeps the link as saved (as drawn): "ลิงก์ /tools", or an em dash for none. */
export function linkLine(b: Banner): Phrase {
  const link = b.linkUrl?.trim() || "—";
  return { th: `ลิงก์ ${link}`, en: `Link ${link}` };
}

/** ▲ / ▼: a new list with the row swapped with its neighbour; nothing at either end. */
export function moved(rows: readonly Banner[], index: number, step: -1 | 1): Banner[] {
  const to = index + step;
  if (to < 0 || to >= rows.length) return [...rows];
  const out = [...rows];
  [out[index], out[to]] = [out[to]!, out[index]!];
  return out;
}

/** Each row's place becomes its order; only the rows whose number changes are sent. */
export function orderPatches(rows: readonly Banner[]): { id: string; sortOrder: number }[] {
  return rows.flatMap((b, i) => (b.sortOrder === i ? [] : [{ id: b.id, sortOrder: i }]));
}

// ── ไปที่ ────────────────────────────────────────────────────────────────────────────────────────

export type LinkChoice =
  | { kind: "none" }
  | { kind: "page"; path: string }
  | { kind: "brand"; id: string }
  | { kind: "category"; id: string }
  | { kind: "car"; name: string }
  | { kind: "product"; id: string }
  | { kind: "external"; url: string };

/** The website's own pages, in the drawn order, with the names the website gives them. */
export const AIRPLUS_PAGES: readonly { path: string; label: Phrase }[] = [
  { path: "/", label: { th: "หน้าแรก", en: "Home" } },
  { path: "/products", label: { th: "สินค้าทั้งหมด", en: "All products" } },
  { path: "/categories", label: { th: "หมวดหมู่สินค้า", en: "Categories" } },
  { path: "/brands", label: { th: "ยี่ห้อรถ", en: "Car makes" } },
  { path: "/coupons", label: { th: "คูปองส่วนลด", en: "Coupons" } },
  { path: "/tools", label: { th: "เครื่องมือช่าง", en: "Mechanic tools" } },
  { path: "/how-to-order", label: { th: "ขั้นตอนการสั่งสินค้า", en: "How to order" } },
  { path: "/info", label: { th: "การจัดส่งและการชำระเงิน", en: "Delivery and payment" } },
  { path: "/returns", label: { th: "การคืน ยกเลิก เคลม", en: "Returns, cancels, claims" } },
  { path: "/faq", label: { th: "คำถามที่พบบ่อย", en: "FAQ" } },
];

/** The link the website opens (the product list reads brand and part by id, a car make by name). */
export function linkOf(c: LinkChoice): string | null {
  switch (c.kind) {
    case "none":
      return null;
    case "page":
      return c.path;
    case "brand":
      return `/products?${new URLSearchParams({ brand: c.id })}`;
    case "category":
      return `/products?${new URLSearchParams({ type: c.id, ctx: "cat" })}`;
    case "car":
      return `/products?${new URLSearchParams({ carBrand: c.name, ctx: "brand" })}`;
    case "product":
      return `/products/${encodeURIComponent(c.id)}`;
    case "external":
      return c.url.trim();
  }
}

/** A broken %-code (typed by hand in the web back office) reads as no id, so the link stays a page. */
function decoded(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

/** A saved link back to its ไปที่. A link the lists don't know stays a page, path and all. */
export function choiceOf(link: string | null): LinkChoice {
  const raw = link?.trim() ?? "";
  if (!raw) return { kind: "none" };
  if (!raw.startsWith("/")) return { kind: "external", url: raw };
  const url = new URL(raw, "https://airplus.invalid");
  const product = /^\/products\/([^/]+)$/.exec(url.pathname);
  const productId = product ? decoded(product[1]!) : null;
  if (productId) return { kind: "product", id: productId };
  if (url.pathname === "/products" && url.search) {
    const p = url.searchParams;
    const keys = [...p.keys()].sort().join(",");
    if (keys === "brand" && p.get("brand")) return { kind: "brand", id: p.get("brand")! };
    if ((keys === "ctx,type" || keys === "type") && p.get("type") && p.get("ctx") !== "brand") {
      return { kind: "category", id: p.get("type")! };
    }
    if (keys === "carBrand,ctx" && p.get("carBrand") && p.get("ctx") === "brand") {
      return { kind: "car", name: p.get("carBrand")! };
    }
  }
  return { kind: "page", path: raw };
}

export interface LinkNames {
  brands: readonly Named[];
  types: readonly Named[];
  products: readonly { id: string; name: string }[];
}

const both = (th: string, en: string = th): Phrase => ({ th, en });

/** What the ไปที่ row shows for a choice; a name the lists no longer have shows as it was saved. */
export function choiceLabel(c: LinkChoice, names: LinkNames): Phrase {
  switch (c.kind) {
    case "none":
      return { th: "คลิกไม่ได้", en: "No tap" };
    case "page":
      return AIRPLUS_PAGES.find((p) => p.path === c.path)?.label ?? both(c.path);
    case "brand": {
      const hit = names.brands.find((b) => b.id === c.id);
      const l = hit ? attrLabel(hit) : both(c.id);
      return { th: `สินค้ายี่ห้อ ${l.th}`, en: `${l.en} products` };
    }
    case "category": {
      const hit = names.types.find((t) => t.id === c.id);
      const l = hit ? attrLabel(hit) : both(c.id);
      return { th: `สินค้าในหมวด ${l.th}`, en: `${l.en}` };
    }
    case "car":
      return { th: `สินค้าสำหรับรถ ${c.name}`, en: `Parts for ${c.name}` };
    case "product": {
      const hit = names.products.find((p) => p.id === c.id);
      return hit ? both(hit.name) : { th: "ไม่พบสินค้านี้", en: "Product not found" };
    }
    case "external":
      return both(c.url.trim().replace(/^https?:\/\//i, ""));
  }
}

/** ลิงก์ภายนอก opens in a new tab, so only an https:// link is kept. */
export function externalProblem(url: string): Phrase | null {
  return /^https:\/\/\S+$/i.test(url.trim())
    ? null
    : { th: "ลิงก์ต้องขึ้นต้นด้วย https://", en: "The link must start with https://" };
}

/** สินค้า's pick list: products on AirPlus whose name or code holds the search, in Thai order. */
export function productChoices(rows: readonly ProductRow[], q: string): ProductRow[] {
  return rows
    .filter((r) => r.status === "active" && matchesSearch(r, q))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

/** "DN-447220 · ฿3,450" — the code and the AirPlus price, under a product's name. */
export function productSub(r: Pick<ProductRow, "productRef" | "onlinePriceSatang">): string {
  return `${r.productRef} · ${formatBaht(r.onlinePriceSatang)}`;
}

// ── the form ─────────────────────────────────────────────────────────────────────────────────────

export interface BannerForm {
  slot: BannerSlot;
  link: LinkChoice;
  startsAt: number | null;
  endsAt: number | null;
  /** เปิดใช้ (edit only; a new banner starts on). */
  on: boolean;
}

export function emptyForm(slot: BannerSlot): BannerForm {
  return { slot, link: { kind: "none" }, startsAt: null, endsAt: null, on: true };
}

export function formOf(b: Banner): BannerForm {
  return {
    slot: b.slot === "promo" ? "promo" : "hero",
    link: choiceOf(b.linkUrl),
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    on: b.status === "active",
  };
}

/** A new banner goes at the end of its slot. */
export function createBody(form: BannerForm, rows: readonly Banner[]) {
  const last = rows.reduce((max, b) => Math.max(max, b.sortOrder), -1);
  return {
    slot: form.slot,
    linkUrl: linkOf(form.link),
    sortOrder: last + 1,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
  };
}

export function patchBody(form: BannerForm) {
  return {
    linkUrl: linkOf(form.link),
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    status: form.on ? "active" : "disabled",
  };
}

/** A new banner needs its picture before บันทึก (an old one may be saved without, as it was). */
export function photoProblem(isNew: boolean, hasPhoto: boolean): Phrase | null {
  return isNew && !hasPhoto ? { th: "เลือกรูปก่อน", en: "Pick a picture first" } : null;
}

export function windowProblem(startsAt: number | null, endsAt: number | null): Phrase | null {
  return startsAt != null && endsAt != null && endsAt < startsAt
    ? { th: "วันสิ้นสุดต้องอยู่หลังวันเริ่ม", en: "The end must be after the start" }
    : null;
}

/** One row of ช่วงเวลา: a day (its start) and minutes after midnight; both empty = that side stays open. */
export interface WhenRow {
  day: number | null;
  minutes: number | null;
}

const rowOf = (ms: number | null): WhenRow =>
  ms == null
    ? { day: null, minutes: null }
    : { day: startOfDay(ms), minutes: new Date(ms).getHours() * 60 + new Date(ms).getMinutes() };

/**
 * What ช่วงเวลา opens with: the saved start and end. A side never set (the web back office can save
 * only a start, or only an end) opens empty rather than filled in; with neither set, both rows start
 * from defaultWindow.
 */
export function whenRows(
  startsAt: number | null,
  endsAt: number | null,
  now: number,
): { start: WhenRow; end: WhenRow } {
  if (startsAt == null && endsAt == null) {
    const first = defaultWindow(now);
    return { start: rowOf(first.startsAt), end: rowOf(first.endsAt) };
  }
  return { start: rowOf(startsAt), end: rowOf(endsAt) };
}

const FILL_BOTH: Phrase = { th: "ใส่วันและเวลาให้ครบ", en: "Fill in both days and times" };

/**
 * ✓ on ช่วงเวลา: an empty row leaves that side open; half a row, or no row at all, needs filling in.
 * `both` (แฟลชเซล): neither side may be left open.
 */
export function windowFromRows(
  start: WhenRow,
  end: WhenRow,
  both = false,
): { startsAt: number | null; endsAt: number | null } | { problem: Phrase } {
  const at = (row: WhenRow): number | null | "half" =>
    row.day == null && row.minutes == null
      ? null
      : row.day == null || row.minutes == null
        ? "half"
        : joinDayTime(row.day, row.minutes);
  const [startsAt, endsAt] = [at(start), at(end)];
  const open = both ? startsAt == null || endsAt == null : startsAt == null && endsAt == null;
  if (startsAt === "half" || endsAt === "half" || open) {
    return { problem: FILL_BOTH };
  }
  const wrong = windowProblem(startsAt, endsAt);
  return wrong ? { problem: wrong } : { startsAt, endsAt };
}

/** Saved, but the picture did not go up: the list says which slide to tap to pick it again. */
export function photoFailedToast(
  slot: BannerSlot,
  index: number,
): { title: Phrase; detail: Phrase } {
  const name = rowName(slot, index);
  return {
    title: { th: "รูปขึ้นไม่สำเร็จ", en: "The picture did not upload" },
    detail: { th: `แตะ${name.th} เพื่อเลือกรูปใหม่`, en: `Tap ${name.en} to pick it again` },
  };
}

// ── ช่วงเวลา: a day box and a time box per end ────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, "0");

/** "23:59" — minutes after midnight as the time box holds them; none → an empty box. */
export function timeField(minutes: number | null): string {
  return minutes == null ? "" : `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
}

/** A time box's "23:59" back to minutes after midnight, or null when it is not a real time. */
export function parseTimeField(text: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** A day (its start) and minutes after midnight, as one moment. */
export function joinDayTime(dayStart: number, minutes: number): number {
  const d = new Date(dayStart);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime();
}

/** Turning กำหนดช่วงเวลา on starts from today 00:00 to this month's last day 23:59 (as drawn). */
export function defaultWindow(now: number): { startsAt: number; endsAt: number } {
  const d = new Date(now);
  return {
    startsAt: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
    endsAt: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59).getTime(),
  };
}
