import type { Phrase } from "@l-shopee/shared";
import { formatBaht } from "./money";

/**
 * ลูกค้า (owner approved the drawing, canvas v151, 30 Oct 2026): the words and order of what the
 * customer pages show. Pure, so the rules the owner set are tested here, not in the screens.
 */

const MONTHS_TH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const BUDDHIST_YEARS = 543;
const DASH: Phrase = { th: "—", en: "—" };
export const MAX_ITEMS = 3;

const same = (text: string): Phrase => ({ th: text, en: text });

/** The province always rides with the plate (owner: "city is the part of plate"). */
export function plateLine(plate: string, province: string | null): string {
  const p = province?.trim();
  return p ? `${plate.trim()} ${p}` : plate.trim();
}

/**
 * A car is stored as one text ("Toyota Vigo 2014"); the page shows the brand over the model. The
 * brand is found by matching the shop's car-brand list, as a whole word at the start.
 */
export function splitCar(
  text: string | null,
  brands: readonly string[],
): { brand: string | null; model: string } {
  const car = (text ?? "").trim();
  const lower = car.toLowerCase();
  const hit = [...brands]
    .sort((a, b) => b.length - a.length)
    .find((b) => {
      const name = b.trim().toLowerCase();
      return name !== "" && (lower === name || lower.startsWith(`${name} `));
    });
  return hit
    ? { brand: hit.trim(), model: car.slice(hit.trim().length).trim() }
    : { brand: null, model: car };
}

/** A list row's date: "30 ต.ค." this year, "31 มี.ค. 68" before it, "—" when never. */
export function rowDate(ms: number | null, now: number): Phrase {
  if (ms === null) return DASH;
  const d = new Date(ms);
  const day = `${d.getDate()} `;
  if (d.getFullYear() === new Date(now).getFullYear()) {
    return { th: day + MONTHS_TH[d.getMonth()], en: day + MONTHS_EN[d.getMonth()] };
  }
  const be = String(d.getFullYear() + BUDDHIST_YEARS).slice(-2);
  return {
    th: `${day}${MONTHS_TH[d.getMonth()]} ${be}`,
    en: `${day}${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`,
  };
}

/** "12 ส.ค. 2569": a visit's or an order's date on its card. */
export function longDate(ms: number): Phrase {
  const d = new Date(ms);
  return {
    th: `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + BUDDHIST_YEARS}`,
    en: `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`,
  };
}

/** At most 3 items on a card, then "และอีก N รายการ" (owner: no one item stands for the visit). */
export function itemsPreview(items: readonly string[]): { shown: string[]; more: number } {
  return { shown: items.slice(0, MAX_ITEMS), more: Math.max(0, items.length - MAX_ITEMS) };
}

/** A car's phones share one field, comma-separated — the way ทำบิล saves them. */
export function phonesOf(phone: string | null): string[] {
  return [
    ...new Set(
      (phone ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
}

export function joinPhones(phones: readonly string[]): string | null {
  const list = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  return list.length > 0 ? list.join(", ") : null;
}

export interface BillLineView {
  lineType: string;
  brandName: string | null;
  unitPriceSatang: number;
  quantity: number;
}

/** The grey line under a bill item: "Suva · ฿195 × 2", or "บริการ · ฿1,200 × 1". */
export function lineSub(l: BillLineView): Phrase {
  const each = `${formatBaht(l.unitPriceSatang)} × ${l.quantity}`;
  if (l.lineType === "service") return { th: `บริการ · ${each}`, en: `Service · ${each}` };
  return same(l.brandName?.trim() ? `${l.brandName.trim()} · ${each}` : each);
}

/** How a bill was paid, in plain words; ทำบิล records cash or PromptPay. */
export function payWord(method: string | null): Phrase | null {
  if (!method) return null;
  if (method === "cash") return { th: "เงินสด", en: "Cash" };
  if (method === "promptpay") return { th: "โอนพร้อมเพย์", en: "PromptPay transfer" };
  return same(method);
}

export interface VisitCard {
  key: string;
  at: number;
  /** The bill number; null for a visit from the old paper/Excel history. */
  number: string | null;
  /** The bill to open; old visits have no bill page. */
  billId: string | null;
  items: string[];
}

interface BillIn {
  id: string;
  saleNumber: string | null;
  createdAt: number;
  lines: readonly { description: string }[];
}
interface LegacyIn {
  id: string;
  happenedAt: number;
  lines: readonly { description: string }[];
}

const descriptions = (lines: readonly { description: string }[]) =>
  lines.map((l) => l.description.trim()).filter(Boolean);

/** ประวัติการใช้บริการ: one card per visit — Kira bills and old visits together, newest first. */
export function visitCards(bills: readonly BillIn[], legacy: readonly LegacyIn[]): VisitCard[] {
  return [
    ...bills.map((b) => ({
      key: b.id,
      at: b.createdAt,
      number: b.saleNumber,
      billId: b.id,
      items: descriptions(b.lines),
    })),
    ...legacy.map((e) => ({
      key: e.id,
      at: e.happenedAt,
      number: null,
      billId: null,
      items: descriptions(e.lines),
    })),
  ].sort((a, b) => b.at - a.at);
}

export interface QuoteCard {
  id: string;
  number: string | null;
  at: number;
  totalSatang: number;
  first: string;
  more: number;
}

/** ใบเสนอราคาที่ยังค้าง: the newest open quotation, as one card. */
export function openQuote(
  quotes: readonly (BillIn & { grandTotalSatang: number })[],
): QuoteCard | null {
  const q = [...quotes].sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!q) return null;
  const items = descriptions(q.lines);
  return {
    id: q.id,
    number: q.saleNumber,
    at: q.createdAt,
    totalSatang: q.grandTotalSatang,
    first: items[0] ?? "",
    more: Math.max(0, items.length - 1),
  };
}

export interface MonthCount {
  month: string;
  count: number;
}

/** The summary card's six bars: each month's name and its height against the tallest. */
export function monthBars(
  months: readonly MonthCount[],
): { key: string; label: Phrase; count: number; share: number }[] {
  const top = Math.max(0, ...months.map((m) => m.count));
  return months.map((m) => {
    const index = Number(m.month.slice(5, 7)) - 1;
    return {
      key: m.month,
      label: { th: MONTHS_TH[index] ?? m.month, en: MONTHS_EN[index] ?? m.month },
      count: m.count,
      share: top > 0 ? m.count / top : 0,
    };
  });
}

export type StatusTone = "waiting" | "success" | "danger" | "muted";

const ORDER_WORDS: Record<string, { word: Phrase; tone: StatusTone }> = {
  going: { word: { th: "กำลังสั่ง", en: "In progress" }, tone: "waiting" },
  done: { word: { th: "สำเร็จ", en: "Done" }, tone: "success" },
  claim: { word: { th: "เคลม", en: "Claim" }, tone: "danger" },
  failed: { word: { th: "ล้มเหลว", en: "Failed" }, tone: "muted" },
};
const STATUS_GROUP: Record<string, keyof typeof ORDER_WORDS> = {
  delivered: "done",
  // A rejected claim leaves the order itself completed.
  claim_rejected: "done",
  claim_pending: "claim",
  claimed: "claim",
  cancelled: "failed",
  expired: "failed",
  delivery_failed: "failed",
};

/** The owner's four short words for every order status (canvas v150). */
export function shortOrderStatus(status: string | null): { word: Phrase; tone: StatusTone } {
  return ORDER_WORDS[STATUS_GROUP[status ?? ""] ?? "going"]!;
}

/** An AirPlus account's name on the list: the name, or why there is none. */
export function accountName(a: { name: string | null; anonymizedAt: number | null }): Phrase {
  if (a.anonymizedAt !== null) return { th: "ลบข้อมูลแล้ว", en: "Data erased" };
  const name = a.name?.trim();
  return name ? same(name) : { th: "(ยังไม่มีชื่อ)", en: "(No name yet)" };
}
