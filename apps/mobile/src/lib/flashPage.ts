import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import { shortDate, rangeLabel } from "./orderList";
import { totalCostSatang } from "./productPage";
import { matchesSearch, stockLevel, type ProductRow } from "./productList";

/**
 * แฟลชเซล's rules (canvas v259, owner 1 Nov 2026): the list in ตอนนี้ / กำลังจะมา / จบแล้ว, each sale's
 * card (B's countdown boxes + C's product photos), the sale page, one form for new and edit (a sale
 * needs at least one product; บันทึก saves it all at once) and the ราคาลด sheet with its ⌄ lines.
 * No screen code here.
 */

/** One product of a sale, as GET /campaigns sends it. */
export interface FlashItem {
  id: string;
  productVariantId: string;
  productName: string;
  productRef: string | null;
  /** The size on sale and its own code; null (or absent, from an older server) without sizes. */
  choiceValue?: string | null;
  choiceCode?: string | null;
  imageKey: string | null;
  /** The AirPlus price the sale cuts from (ราคาปกติ). */
  basePriceSatang: number;
  campaignPriceSatang: number;
  stockCap: number | null;
  soldCount: number;
}

export interface FlashSale {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  /** active | disabled (เปิดใช้ off). */
  status: string;
  createdAt: number;
  prices: FlashItem[];
}

export type FlashState = "live" | "waiting" | "off" | "ended";

export const STATE_WORDS: Record<FlashState, Phrase> = {
  live: { th: "กำลังลดอยู่", en: "On now" },
  waiting: { th: "รอเริ่ม", en: "Starting soon" },
  off: { th: "ปิดอยู่", en: "Off" },
  ended: { th: "จบแล้ว", en: "Ended" },
};

/** The dot's colour by state: green on now, amber waiting, grey otherwise (the words stay grey). */
export const STATE_TONE: Record<FlashState, "good" | "waiting" | "muted"> = {
  live: "good",
  waiting: "waiting",
  off: "muted",
  ended: "muted",
};

export function flashState(s: FlashSale, now: number): FlashState {
  if (s.endsAt <= now) return "ended";
  if (s.status !== "active") return "off";
  return s.startsAt > now ? "waiting" : "live";
}

export interface FlashSection {
  key: "now" | "soon" | "done";
  label: Phrase;
  sales: FlashSale[];
}

/** ตอนนี้ (ending soonest first), กำลังจะมา (waiting and off, starting soonest first), จบแล้ว (newest). */
export function sections(sales: readonly FlashSale[], now: number): FlashSection[] {
  const of = (...states: FlashState[]) => sales.filter((s) => states.includes(flashState(s, now)));
  const all: FlashSection[] = [
    {
      key: "now",
      label: { th: "ตอนนี้", en: "Now" },
      sales: of("live").sort((a, b) => a.endsAt - b.endsAt),
    },
    {
      key: "soon",
      label: { th: "กำลังจะมา", en: "Coming up" },
      sales: of("waiting", "off").sort((a, b) => a.startsAt - b.startsAt),
    },
    {
      key: "done",
      label: { th: "จบแล้ว", en: "Ended" },
      sales: of("ended").sort((a, b) => b.endsAt - a.endsAt),
    },
  ];
  return all.filter((s) => s.sales.length > 0);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const two = (n: number) => String(n).padStart(2, "0");
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export interface ClockTile {
  value: string;
  unit: Phrase;
}

/** The boxes on a live or waiting card: under a day → hours and minutes; longer → days. */
export function clock(s: FlashSale, now: number): { side: Phrase; tiles: ClockTile[] } | null {
  const state = flashState(s, now);
  if (state !== "live" && state !== "waiting") return null;
  const left = Math.max(0, (state === "live" ? s.endsAt : s.startsAt) - now);
  const side: Phrase =
    state === "live" ? { th: "จบใน", en: "Ends in" } : { th: "เริ่มใน", en: "Starts in" };
  if (left >= DAY) {
    return {
      side,
      tiles: [{ value: String(Math.floor(left / DAY)), unit: { th: "วัน", en: "days" } }],
    };
  }
  return {
    side,
    tiles: [
      { value: two(Math.floor(left / HOUR)), unit: { th: "ชม.", en: "h" } },
      { value: two(Math.floor((left % HOUR) / MINUTE)), unit: { th: "นาที", en: "min" } },
    ],
  };
}

/** The card's grey line: a live sale says when it ends; the others their dates. */
export function listLine(s: FlashSale, now: number): Phrase {
  const state = STATE_WORDS[flashState(s, now)];
  if (flashState(s, now) === "live") {
    const day = shortDate(s.endsAt);
    const until = sameDay(s.endsAt, now)
      ? { th: hhmm(s.endsAt), en: hhmm(s.endsAt) }
      : { th: `${day.th} ${hhmm(s.endsAt)}`, en: `${day.en} ${hhmm(s.endsAt)}` };
    return { th: `${state.th} · ถึง ${until.th}`, en: `${state.en} · until ${until.en}` };
  }
  const days = rangeLabel({ from: s.startsAt, to: s.endsAt });
  return { th: `${state.th} · ${days.th}`, en: `${state.en} · ${days.en}` };
}

/** How much the sale price cuts off the normal price, in whole percent. */
export function offPercent(baseSatang: number, saleSatang: number): number {
  if (baseSatang <= 0 || saleSatang >= baseSatang) return 0;
  return Math.round(((baseSatang - saleSatang) / baseSatang) * 100);
}

const PHOTOS = 3;

/** The card's photos (three, each with its -%), how many more, and what sold once the sale began. */
export function strip(s: FlashSale, now: number) {
  const state = flashState(s, now);
  const sold = s.prices.reduce((n, p) => n + p.soldCount, 0);
  return {
    photos: s.prices.slice(0, PHOTOS).map((p) => ({
      key: p.id,
      imageKey: p.imageKey,
      off: `${offPercent(p.basePriceSatang, p.campaignPriceSatang)}%`,
    })),
    more: Math.max(0, s.prices.length - PHOTOS),
    sold:
      state === "live" || state === "ended"
        ? ({ th: `ขายแล้ว ${sold}`, en: `${sold} sold` } as Phrase)
        : null,
  };
}

export function soldLine(p: Pick<FlashItem, "soldCount" | "stockCap">): Phrase {
  return p.stockCap
    ? { th: `ขายแล้ว ${p.soldCount} จาก ${p.stockCap}`, en: `${p.soldCount} of ${p.stockCap} sold` }
    : { th: `ขายแล้ว ${p.soldCount} · ไม่จำกัด`, en: `${p.soldCount} sold · no limit` };
}

export function capLine(cap: string): Phrase {
  return cap ? { th: `จำกัด ${cap} ชิ้น`, en: `Limit ${cap}` } : { th: "ไม่จำกัด", en: "No limit" };
}

function leftWords(ms: number): Phrase {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  return days > 0
    ? { th: `${days} วัน ${hours} ชม.`, en: `${days} d ${hours} h` }
    : { th: `${hours} ชม. ${minutes} นาที`, en: `${hours} h ${minutes} min` };
}

/** สถานะ on the sale page: a live sale says how long is left. */
export function pageStatus(s: FlashSale, now: number): Phrase {
  const state = flashState(s, now);
  const words = STATE_WORDS[state];
  if (state !== "live") return words;
  const left = leftWords(Math.max(0, s.endsAt - now));
  return { th: `${words.th} · จบใน ${left.th}`, en: `${words.en} · ends in ${left.en}` };
}

function window(startsAt: number, endsAt: number, year: boolean): Phrase {
  const [a, b] = [shortDate(startsAt), shortDate(endsAt)];
  if (sameDay(startsAt, endsAt)) {
    const y = new Date(startsAt).getFullYear();
    const day = year ? { th: `${a.th} ${y + 543} ·`, en: `${a.en} ${y} ·` } : a;
    return {
      th: `${day.th} ${hhmm(startsAt)} – ${hhmm(endsAt)}`,
      en: `${day.en} ${hhmm(startsAt)} – ${hhmm(endsAt)}`,
    };
  }
  return {
    th: `${a.th} ${hhmm(startsAt)} – ${b.th} ${hhmm(endsAt)}`,
    en: `${a.en} ${hhmm(startsAt)} – ${b.en} ${hhmm(endsAt)}`,
  };
}

/**
 * ช่วงเวลา on the sale page: "29 ต.ค. 2569 · 00:00 – 23:59"; whole days "10–11 ต.ค. 2569" (canvas
 * v259); otherwise each day with its time.
 */
export function pageWindow(startsAt: number, endsAt: number): Phrase {
  const wholeDays = hhmm(startsAt) === "00:00" && hhmm(endsAt) === "23:59";
  if (sameDay(startsAt, endsAt) || !wholeDays) return window(startsAt, endsAt, true);
  const days = rangeLabel({ from: startsAt, to: endsAt });
  const y = new Date(endsAt).getFullYear();
  return { th: `${days.th} ${y + 543}`, en: `${days.en} ${y}` };
}

/** ช่วงเวลา on the form; เลือก until it is set. */
export function formWindow(startsAt: number | null, endsAt: number | null): Phrase {
  if (startsAt == null || endsAt == null) return { th: "เลือก", en: "Choose" };
  return window(startsAt, endsAt, false);
}

// ── the form ─────────────────────────────────────────────────────────────────────────────────────

/** A product on the form: picked now (no priceId) or already in the sale. Prices as typed, in baht. */
export interface FlashLine {
  priceId: string | null;
  productVariantId: string;
  name: string;
  productRef: string | null;
  /** The size on sale ("1/2 กลาง"); absent for a product without sizes. */
  choiceValue?: string;
  imageKey: string | null;
  basePriceSatang: number;
  sale: string;
  cap: string;
  soldCount: number;
}

export interface FlashForm {
  name: string;
  startsAt: number | null;
  endsAt: number | null;
  on: boolean;
  lines: FlashLine[];
}

export const emptyForm = (): FlashForm => ({
  name: "",
  startsAt: null,
  endsAt: null,
  on: true,
  lines: [],
});

/** Baht as the box shows it: "2,990" (whole baht) or "2,990.50". */
export const bahtText = (satang: number) =>
  (satang / 100).toLocaleString("en-US", {
    minimumFractionDigits: satang % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

export const toSatang = (text: string) => Math.round(Number(text.replace(/,/g, "")) * 100);

const capOf = (text: string) => (text ? Number(text) : null);

export function formOf(s: FlashSale): FlashForm {
  return {
    name: s.name,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    on: s.status === "active",
    lines: s.prices.map((p) => ({
      priceId: p.id,
      productVariantId: p.productVariantId,
      name: p.productName,
      // A size on sale shows its own code and its value (11 Nov 2026).
      productRef: p.choiceValue ? (p.choiceCode ?? p.productRef) : p.productRef,
      ...(p.choiceValue ? { choiceValue: p.choiceValue } : {}),
      imageKey: p.imageKey,
      basePriceSatang: p.basePriceSatang,
      sale: bahtText(p.campaignPriceSatang),
      cap: p.stockCap ? String(p.stockCap) : "",
      soldCount: p.soldCount,
    })),
  };
}

/** A product just picked, with the sale price and limit typed in the ราคาลด sheet. */
export function lineOf(r: ProductRow, sale: string, cap: string): FlashLine {
  return {
    priceId: null,
    productVariantId: r.variantId,
    name: r.name,
    // A size goes on sale under its own code (7 Nov 2026).
    productRef: r.optionValue ? (r.code ?? r.productRef) : r.productRef,
    ...(r.optionValue ? { choiceValue: r.optionValue } : {}),
    imageKey: r.imageKey,
    basePriceSatang: r.onlinePriceSatang,
    sale,
    cap,
    soldCount: 0,
  };
}

export type FlashProblems = Partial<Record<"name" | "when" | "lines", Phrase>>;

/** บันทึก names only what is still empty, under each box (rulebook §5). */
export function formProblems(f: FlashForm): FlashProblems {
  const out: FlashProblems = {};
  if (!f.name.trim()) out.name = { th: "ยังไม่ได้ใส่ชื่อแคมเปญ", en: "No name yet" };
  if (f.startsAt == null || f.endsAt == null) {
    out.when = { th: "ยังไม่ได้เลือกช่วงเวลา", en: "No dates yet" };
  }
  if (f.lines.length === 0) out.lines = { th: "ยังไม่ได้เลือกสินค้า", en: "No products yet" };
  return out;
}

const priceOf = (l: FlashLine) => ({
  productVariantId: l.productVariantId,
  campaignPriceSatang: toSatang(l.sale),
  stockCap: capOf(l.cap),
});

/** POST /campaigns: the sale and every product, saved together. */
export function createBody(f: FlashForm) {
  return {
    name: f.name.trim(),
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    prices: f.lines.map(priceOf),
  };
}

/** PATCH /campaigns/:id: the sale's fields and only the products added, changed or binned. */
export function editBody(f: FlashForm, old: FlashSale) {
  const kept = new Set(f.lines.map((l) => l.priceId).filter(Boolean));
  const was = new Map(old.prices.map((p) => [p.id, p]));
  return {
    name: f.name.trim(),
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    status: f.on ? "active" : "disabled",
    prices: {
      add: f.lines.filter((l) => !l.priceId).map(priceOf),
      update: f.lines
        .filter((l) => {
          const p = l.priceId ? was.get(l.priceId) : undefined;
          return p && (p.campaignPriceSatang !== toSatang(l.sale) || p.stockCap !== capOf(l.cap));
        })
        .map((l) => ({
          id: l.priceId!,
          campaignPriceSatang: toSatang(l.sale),
          stockCap: capOf(l.cap),
        })),
      remove: old.prices.filter((p) => !kept.has(p.id)).map((p) => p.id),
    },
  };
}

// ── the ราคาลด sheet ─────────────────────────────────────────────────────────────────────────────

export interface SheetLine {
  label: Phrase;
  text: string;
  /** Red words: below the cost. */
  loss: boolean;
}

type Costed = Pick<ProductRow, "itemCostSatang" | "taxOnCost" | "onlinePriceSatang">;

export const totalCost = (r: Costed) => totalCostSatang(r.itemCostSatang, r.taxOnCost === 1);

/** ต้นทุน ⌄: the product's cost, and the VAT on it when the shop adds it (as สินค้า shows). */
export function costLines(r: Costed): SheetLine[] {
  const lines: SheetLine[] = [
    {
      label: { th: "ต้นทุนสินค้า", en: "Item cost" },
      text: formatBaht(r.itemCostSatang),
      loss: false,
    },
  ];
  const vat = totalCost(r) - r.itemCostSatang;
  if (vat > 0)
    lines.push({
      label: { th: "VAT 7%", en: "VAT 7%" },
      text: `+ ${formatBaht(vat)}`,
      loss: false,
    });
  return lines;
}

/**
 * What is left at an AirPlus price: กำไร, or ขาดทุน per piece in red — price − cost, as drawn. AirPlus is
 * the shop's own website, so no Shopee commission comes off (the old per-product one is not read).
 */
export function profitLines(r: Costed, priceSatang: number): SheetLine[] {
  const profit = priceSatang - totalCost(r);
  if (profit < 0) {
    return [
      { label: { th: "ขาดทุน", en: "Loss" }, text: `${formatBaht(-profit)} ต่อชิ้น`, loss: true },
    ];
  }
  const margin = priceSatang > 0 ? Math.round((profit / priceSatang) * 100) : 0;
  return [
    {
      label: { th: "กำไร", en: "Profit" },
      text: `${formatBaht(profit)} · ${margin}%`,
      loss: false,
    },
  ];
}

/** ราคาลด ⌄: how much off the normal price, then (for who may see cost) the profit or loss. */
export function saleLines(r: Costed, saleSatang: number, seesCost: boolean): SheetLine[] {
  const off: SheetLine = {
    label: { th: "ลด", en: "Off" },
    text: `${formatBaht(Math.max(0, r.onlinePriceSatang - saleSatang))} · ${offPercent(r.onlinePriceSatang, saleSatang)}%`,
    loss: false,
  };
  return seesCost ? [off, ...profitLines(r, saleSatang)] : [off];
}

export function priceProblem(sale: string): Phrase | null {
  return toSatang(sale) > 0 ? null : { th: "ยังไม่ได้ใส่ราคาลด", en: "No sale price yet" };
}

/** The add list: products on AirPlus with stock to sell (rulebook: 0 in stock never shows), Thai order. */
export function pickable(rows: readonly ProductRow[], q: string): ProductRow[] {
  return rows
    .filter((r) => r.status === "active" && r.onHand > 0 && matchesSearch(r, q))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

/** The add list's grey line: how many are left (เหลือน้อย at 3 or fewer) and the AirPlus price. */
export function pickLine(r: ProductRow): { low: boolean; text: Phrase } {
  const low = stockLevel(r.onHand) === "low";
  const price = formatBaht(r.onlinePriceSatang);
  return {
    low,
    text: low
      ? { th: `เหลือน้อย ${r.onHand} · ${price}`, en: `Low ${r.onHand} · ${price}` }
      : { th: `เหลือ ${r.onHand} · ${price}`, en: `${r.onHand} left · ${price}` },
  };
}

/** A price as typed, shown with its commas ("2000" → "2,000"). */
export function grouped(typed: string): string {
  const [whole = "", ...rest] = typed.replace(/,/g, "").split(".");
  const commas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length ? `${commas}.${rest.join("")}` : commas;
}
