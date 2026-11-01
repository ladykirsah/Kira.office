import type { Phrase } from "@l-shopee/shared/lang";
import {
  DATE_PRESETS,
  dateRange,
  dayTitle,
  rangeLabel,
  startOfDay,
  type CustomRange,
  type DatePreset,
} from "./orderList";

/**
 * The rules behind ประวัติซื้อขาย (owner approved the drawing, canvas v228, 1 Nov 2026): every stock
 * change, newest first, by day; a type button, search and a date button narrow it. There is no
 * นับใหม่ or ของเสีย (owner: "we do not need นับใหม่ and ของเสีย"): every hand-made change reads
 * ปรับสต็อก. No screen code here.
 */

/** One stock change as GET /stock/movements lists it. */
export interface Movement {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string;
  productRef: string | null;
  imageKey: string | null;
  movementType: string;
  quantityDelta: number;
  quantityAfter: number;
  /** A sale's price per piece; null for every other change. */
  salePriceSatang: number | null;
  createdAt: number;
}

export type MovementKind = "all" | "refill" | "sale" | "adjust" | "return" | "job" | "opening";

/** The type buttons, in the drawing's order. */
export const MOVEMENT_KINDS: readonly { key: MovementKind; label: Phrase }[] = [
  { key: "all", label: { th: "ทั้งหมด", en: "All" } },
  { key: "refill", label: { th: "เติมสต็อก", en: "Restock" } },
  { key: "sale", label: { th: "ขาย", en: "Sales" } },
  { key: "adjust", label: { th: "ปรับสต็อก", en: "Adjusted" } },
  { key: "return", label: { th: "คืนของ", en: "Returns" } },
  { key: "job", label: { th: "งานนอก", en: "Outside jobs" } },
  { key: "opening", label: { th: "ยอดยกมา", en: "Opening" } },
];

/** Each ledger type: its button and the words its row says. */
const TYPES: Record<string, { kind: Exclude<MovementKind, "all">; label: Phrase }> = {
  onsite_sale: { kind: "sale", label: { th: "ขายเด่นแอร์", en: "Sold at เด่นแอร์" } },
  online_sale: { kind: "sale", label: { th: "ขายออนไลน์", en: "Sold online" } },
  hold: { kind: "job", label: { th: "ไปงานนอก", en: "Out to a job" } },
  unhold: { kind: "job", label: { th: "กลับจากงานนอก", en: "Back from a job" } },
  receive: { kind: "refill", label: { th: "เติมสต็อก", en: "Restocked" } },
  purchase_receipt: { kind: "refill", label: { th: "เติมสต็อก", en: "Restocked" } },
  refund_return: { kind: "return", label: { th: "คืนของ", en: "Returned" } },
  refund: { kind: "return", label: { th: "คืนของ", en: "Returned" } },
  opening_balance: { kind: "opening", label: { th: "ยอดยกมา", en: "Opening stock" } },
};

const ADJUSTED: Phrase = { th: "ปรับสต็อก", en: "Adjusted" };

/** Any other hand-made change (a count, a write-off, a transfer) reads ปรับสต็อก. */
const typeOf = (type: string) => TYPES[type] ?? { kind: "adjust" as const, label: ADJUSTED };

export function movementLabel(type: string): Phrase {
  return typeOf(type).label;
}

/** Search: a change matches when its name or code holds the words (match = result, owner 29 Oct). */
function matches(m: Movement, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [m.productName, m.productRef, m.sku].some((s) => s?.toLowerCase().includes(needle));
}

export function shownMovements(
  rows: readonly Movement[],
  view: { kind: MovementKind; q: string },
): Movement[] {
  return rows.filter(
    (m) => (view.kind === "all" || typeOf(m.movementType).kind === view.kind) && matches(m, view.q),
  );
}

/** The badge: "+6", "−1" (a real minus sign). */
export function changeText(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${-delta}`;
  return "0";
}

/** The grey line under the title: how many show, "ล่าสุด" when the server's list stopped at its limit. */
export function movementSubtitle(c: { shown: number; total: number; limit: number }): Phrase {
  return c.shown === c.total && c.total >= c.limit
    ? { th: `${c.total} รายการล่าสุด`, en: `Latest ${c.total}` }
    : { th: `${c.shown} รายการ`, en: `${c.shown} ${c.shown === 1 ? "change" : "changes"}` };
}

/** One group per day, in the order the changes come (newest first), titled as Orders titles days. */
export function movementSections(
  rows: readonly Movement[],
  now: number,
): { title: Phrase; rows: Movement[] }[] {
  const days: { day: number; rows: Movement[] }[] = [];
  for (const m of rows) {
    const day = startOfDay(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(m);
    else days.push({ day, rows: [m] });
  }
  return days.map((d) => ({ title: dayTitle(d.day, now), rows: d.rows }));
}

/** The detail's เมื่อ: the day only (owner: "we did not collect time only date"). */
export function whenText(ms: number, now: number): Phrase {
  const day = dayTitle(startOfDay(ms), now);
  const year = new Date(ms).getFullYear();
  if (year === new Date(now).getFullYear()) return day;
  return { th: `${day.th} ${year + 543}`, en: `${day.en} ${year}` };
}

/** Why a search found nothing: the type and the words, and that only the latest were looked at. */
export function noMatchDetail(kind: Phrase | null, q: string, limit: number | null): Phrase {
  const words = q.trim();
  const ofWords = words ? `${kind ? " " : ""}ของ “${words}”` : "";
  const th = `ไม่มีรายการ${kind ? ` “${kind.th}”` : ""}${ofWords}`;
  const en = `No ${kind ? `“${kind.en}” ` : ""}changes${words ? ` for “${words}”` : ""}`;
  if (limit == null) return { th, en };
  return { th: `${th}\nใน ${limit} รายการล่าสุด`, en: `${en}\nin the latest ${limit}` };
}

/** The date button's choice as dates to ask for; ทุกวัน (or no days picked yet) asks for none. */
export function periodOf(
  date: DatePreset,
  custom: CustomRange | null,
  now: number,
): { start: number; end: number } | null {
  if (date === "all" || (date === "custom" && !custom)) return null;
  return dateRange(date, custom, now);
}

const ANY_DAY = DATE_PRESETS.find((p) => p.key === "all")!;

/** The date button's words: the preset, or the two picked days. */
export function periodLabel(date: DatePreset, custom: CustomRange | null): Phrase {
  if (date === "custom" && custom) return rangeLabel(custom);
  return (DATE_PRESETS.find((p) => p.key === date) ?? ANY_DAY).label;
}
