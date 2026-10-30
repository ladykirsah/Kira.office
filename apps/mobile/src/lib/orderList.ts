import { operationalStatus, operationalStatusPhrase, type OperationalStatus } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";

/**
 * The rules behind the Orders list (owner picked choice B, 2026-10-29: status tabs with counts on
 * the list, then date, payment and sort buttons), taken from the web back office's Orders page so
 * both apps sort an order into the same place: the status tabs, the date ranges, search, and the
 * line that says what an order is waiting for. No screen code here.
 */

/** One order as GET /orders lists it — only the fields the phone list reads. */
export interface OrderListRow {
  id: string;
  channel: string;
  externalOrderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  grandTotalSatang: number;
  orderCreatedAt: number | null;
  importedAt: number;
  buyerUsername?: string | null;
  firstItemImageKey?: string | null;
  /** The first product line's name, and how many lines there are ("+ อีก 1 รายการ"). */
  firstItemName?: string | null;
  lineCount?: number;
}

export type OrderTab =
  "unpaid" | "pending" | "toship" | "shipped" | "completed" | "cancelfail" | "refundclaim";

/** Each status lives in exactly one tab (the web's ORDER_TAB_STATUSES, owner's sections 2 Aug). */
export const ORDER_TABS: readonly {
  key: OrderTab;
  label: Phrase;
  statuses: OperationalStatus[];
}[] = [
  { key: "unpaid", label: { th: "รอชำระ", en: "Unpaid" }, statuses: ["unpaid"] },
  {
    key: "pending",
    label: { th: "รอดำเนินการ", en: "Pending" },
    statuses: ["cod_pending", "verifying"],
  },
  { key: "toship", label: { th: "เตรียมส่ง", en: "To ship" }, statuses: ["to_ship"] },
  { key: "shipped", label: { th: "กำลังส่ง", en: "In transit" }, statuses: ["in_transit"] },
  { key: "completed", label: { th: "สำเร็จ", en: "Completed" }, statuses: ["complete"] },
  {
    key: "cancelfail",
    label: { th: "ยกเลิก", en: "Cancelled" },
    statuses: ["fail", "cod_reject"],
  },
  {
    key: "refundclaim",
    label: { th: "คืนเงิน", en: "Refunds" },
    statuses: ["return", "claim_pending", "claimed", "refunded", "claim_rejected"],
  },
];

export const ALL_TAB_LABEL: Phrase = { th: "ทั้งหมด", en: "All" };

export type DatePreset = "today" | "7d" | "30d" | "month" | "lastmonth" | "all" | "custom";

export const DATE_PRESETS: readonly { key: DatePreset; label: Phrase }[] = [
  { key: "today", label: { th: "วันนี้", en: "Today" } },
  { key: "7d", label: { th: "7 วันล่าสุด", en: "Last 7 days" } },
  { key: "30d", label: { th: "30 วันล่าสุด", en: "Last 30 days" } },
  { key: "month", label: { th: "เดือนนี้", en: "This month" } },
  { key: "lastmonth", label: { th: "เดือนก่อน", en: "Last month" } },
  { key: "all", label: { th: "ทุกวัน", en: "Any date" } },
  { key: "custom", label: { th: "กำหนดเอง…", en: "Pick dates…" } },
];

/** Two days picked by hand; both are whole days, and the order they were picked in doesn't matter. */
export interface CustomRange {
  from: number;
  to: number;
}

/** "all", or one raw payment state — the web's payment filter. */
export type PayFilter = string;

export const PAY_FILTERS: readonly { key: PayFilter; label: Phrase }[] = [
  { key: "all", label: { th: "ทุกแบบ", en: "Any" } },
  { key: "pending", label: { th: "รอชำระเงิน", en: "Pending" } },
  { key: "verifying", label: { th: "รอตรวจสลิป", en: "Slip to check" } },
  { key: "paid", label: { th: "ชำระแล้ว", en: "Paid" } },
  { key: "cod", label: { th: "เก็บเงินปลายทาง", en: "COD" } },
  { key: "cod_confirmed", label: { th: "อนุมัติเก็บปลายทาง", en: "COD approved" } },
  { key: "cod_collected", label: { th: "เก็บเงินแล้ว", en: "COD collected" } },
  { key: "cod_denied", label: { th: "ปฏิเสธเก็บปลายทาง", en: "COD denied" } },
  { key: "refunded", label: { th: "คืนเงินแล้ว", en: "Refunded" } },
];

export type SortBy = "newest" | "oldest" | "status" | "payment";

export const SORTS: readonly { key: SortBy; label: Phrase }[] = [
  { key: "newest", label: { th: "ใหม่สุดก่อน", en: "Newest first" } },
  { key: "oldest", label: { th: "เก่าสุดก่อน", en: "Oldest first" } },
  { key: "status", label: { th: "ตามสถานะ", en: "By status" } },
  { key: "payment", label: { th: "ตามการชำระเงิน", en: "By payment" } },
];

export interface OrderView {
  tab: OrderTab | "all";
  date: DatePreset;
  /** The picked days, kept while `date` is "custom". */
  custom: CustomRange | null;
  pay: PayFilter;
  sort: SortBy;
}

/** What the list opens on: every order, every date — an open job from last week stays in sight. */
export const DEFAULT_VIEW: OrderView = {
  tab: "all",
  date: "all",
  custom: null,
  pay: "all",
  sort: "newest",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the order was placed; an imported order without one is placed by its import. */
export function placedAt(o: OrderListRow): number {
  return o.orderCreatedAt ?? o.importedAt;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dateRange(
  preset: DatePreset,
  custom: CustomRange | null,
  now: number,
): { start: number; end: number } {
  const d = new Date(now);
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "7d":
      return { start: now - 7 * DAY_MS, end: now };
    case "30d":
      return { start: now - 30 * DAY_MS, end: now };
    case "month":
      return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: now };
    case "lastmonth":
      return {
        start: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(),
        end: new Date(d.getFullYear(), d.getMonth(), 1).getTime() - 1,
      };
    case "custom": {
      if (!custom) return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
      const first = startOfDay(Math.min(custom.from, custom.to));
      const last = startOfDay(Math.max(custom.from, custom.to));
      const next = new Date(last);
      return {
        start: first,
        end: new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1).getTime() - 1,
      };
    }
    case "all":
      return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
  }
}

const airplus = (rows: readonly OrderListRow[]) => rows.filter((o) => o.channel === "airplus");

const statusOf = (o: OrderListRow) => operationalStatus(o.orderStatus, o.paymentStatus);

function inTab(o: OrderListRow, tab: OrderTab | "all"): boolean {
  if (tab === "all") return true;
  const s = statusOf(o);
  return s != null && (ORDER_TABS.find((t) => t.key === tab)?.statuses.includes(s) ?? false);
}

function inDates(o: OrderListRow, view: Pick<OrderView, "date" | "custom">, now: number): boolean {
  const { start, end } = dateRange(view.date, view.custom, now);
  const t = placedAt(o);
  return t >= start && t <= end;
}

const newestFirst = (a: OrderListRow, b: OrderListRow) => placedAt(b) - placedAt(a);

const tabRank = (o: OrderListRow) => {
  const s = statusOf(o);
  const i = s == null ? -1 : ORDER_TABS.findIndex((tab) => tab.statuses.includes(s));
  return i < 0 ? ORDER_TABS.length : i;
};

const payRank = (o: OrderListRow) => {
  const i = PAY_FILTERS.findIndex((p) => p.key === o.paymentStatus);
  return i < 0 ? PAY_FILTERS.length : i;
};

/** Sorting by status or payment follows the tabs' and the payment menu's order, newest first inside. */
const byRank = (rank: (o: OrderListRow) => number) => (a: OrderListRow, b: OrderListRow) =>
  rank(a) - rank(b) || newestFirst(a, b);

const SORT_ORDER: Record<SortBy, (a: OrderListRow, b: OrderListRow) => number> = {
  newest: newestFirst,
  oldest: (a, b) => newestFirst(b, a),
  status: byRank(tabRank),
  payment: byRank(payRank),
};

const inPay = (o: OrderListRow, pay: PayFilter) => pay === "all" || o.paymentStatus === pay;

export function viewOrders(
  rows: readonly OrderListRow[],
  view: OrderView,
  now: number,
): OrderListRow[] {
  return airplus(rows)
    .filter((o) => inDates(o, view, now) && inTab(o, view.tab) && inPay(o, view.pay))
    .sort(SORT_ORDER[view.sort]);
}

/** How many orders each status tab holds under the chosen dates and payment — what a tap would show. */
export function tabCounts(
  rows: readonly OrderListRow[],
  view: OrderView,
  now: number,
): Record<OrderTab | "all", number> {
  const shown = airplus(rows).filter((o) => inDates(o, view, now) && inPay(o, view.pay));
  const counts = { all: shown.length } as Record<OrderTab | "all", number>;
  for (const tab of ORDER_TABS) counts[tab.key] = shown.filter((o) => inTab(o, tab.key)).length;
  return counts;
}

/** Order number or customer name, over every date — a search for a name should not miss last week. */
export function searchOrders(rows: readonly OrderListRow[], query: string): OrderListRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return airplus(rows)
    .filter(
      (o) =>
        o.externalOrderId.toLowerCase().includes(q) ||
        (o.buyerUsername ?? "").toLowerCase().includes(q),
    )
    .sort(newestFirst);
}

export type StepIcon = "slip" | "cod" | "ship" | "back" | "claim";
export type StepTone = "waiting" | "toShip" | "danger" | "muted";

export interface NextStep {
  /** The job waiting on the order's page, or its plain status when nothing is. */
  text: Phrase;
  /** True when the shop has to do something: the line is black with a coloured icon. */
  waiting: boolean;
  icon: StepIcon | null;
  tone: StepTone;
}

/** The jobs that wait on the shop (the web's order card, design D), each with its icon colour. */
const JOBS: Partial<Record<OperationalStatus, Omit<NextStep, "waiting">>> = {
  verifying: {
    text: { th: "ตรวจการชำระเงิน", en: "Review payment" },
    icon: "slip",
    tone: "waiting",
  },
  cod_pending: { text: { th: "อนุมัติปลายทาง", en: "Approve COD" }, icon: "cod", tone: "waiting" },
  to_ship: { text: { th: "บันทึกการส่งของ", en: "Record drop-off" }, icon: "ship", tone: "toShip" },
  return: {
    text: { th: "จัดการพัสดุตีกลับ", en: "Handle the return" },
    icon: "back",
    tone: "danger",
  },
  claim_pending: { text: { th: "ตรวจเคลม", en: "Review claim" }, icon: "claim", tone: "waiting" },
  claimed: { text: { th: "ตรวจเคลม", en: "Review claim" }, icon: "claim", tone: "waiting" },
};

const UNKNOWN: Phrase = { th: "สถานะไม่ทราบ", en: "Status unknown" };

export function nextStep(orderStatus: string | null, paymentStatus: string | null): NextStep {
  const s = operationalStatus(orderStatus, paymentStatus);
  if (s == null) return { text: UNKNOWN, waiting: false, icon: null, tone: "muted" };
  const job = JOBS[s];
  if (job) return { ...job, waiting: true };
  return { text: operationalStatusPhrase(s), waiting: false, icon: null, tone: "muted" };
}

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

/** "24 ต.ค." — a short date for older days and search results. */
export function shortDate(ms: number): Phrase {
  const d = new Date(ms);
  return {
    th: `${d.getDate()} ${MONTHS_TH[d.getMonth()]}`,
    en: `${d.getDate()} ${MONTHS_EN[d.getMonth()]}`,
  };
}

/** The date button's words for a picked range: "20–22 ต.ค.", "28 ก.ย. – 3 ต.ค.", or one day. */
export function rangeLabel(range: CustomRange): Phrase {
  const a = new Date(Math.min(range.from, range.to));
  const b = new Date(Math.max(range.from, range.to));
  const first = shortDate(a.getTime());
  const last = shortDate(b.getTime());
  if (startOfDay(a.getTime()) === startOfDay(b.getTime())) return first;
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return { th: `${a.getDate()}–${last.th}`, en: `${a.getDate()}–${last.en}` };
  }
  return { th: `${first.th} – ${last.th}`, en: `${first.en} – ${last.en}` };
}

/** A day as a date box holds it: "2026-10-05". */
export function dayField(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** A date box's "2026-10-05" back to the start of that day, or null when it is not a real day. */
export function parseDayField(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const day = new Date(y, mo, d);
  return day.getFullYear() === y && day.getMonth() === mo && day.getDate() === d
    ? day.getTime()
    : null;
}

/** "14:20". */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dayTitle(dayStart: number, now: number): Phrase {
  const today = startOfDay(now);
  if (dayStart === today) return { th: "วันนี้", en: "Today" };
  if (dayStart === startOfDay(today - 1)) return { th: "เมื่อวาน", en: "Yesterday" };
  return shortDate(dayStart);
}

/** The list's day groups, in the order the rows already come in. */
export function daySections(
  rows: readonly OrderListRow[],
  now: number,
): { title: Phrase; rows: OrderListRow[] }[] {
  const sections: { day: number; title: Phrase; rows: OrderListRow[] }[] = [];
  for (const o of rows) {
    const day = startOfDay(placedAt(o));
    const last = sections[sections.length - 1];
    if (last && last.day === day) last.rows.push(o);
    else sections.push({ day, title: dayTitle(day, now), rows: [o] });
  }
  return sections.map(({ title, rows: r }) => ({ title, rows: r }));
}

const OTHER: Phrase = { th: "อื่น ๆ", en: "Other" };

/** Consecutive rows that share a heading become one group, in the order the rows come in. */
function groupBy(
  rows: readonly OrderListRow[],
  title: (o: OrderListRow) => Phrase,
): { title: Phrase; rows: OrderListRow[] }[] {
  const sections: { title: Phrase; rows: OrderListRow[] }[] = [];
  for (const o of rows) {
    const head = title(o);
    const last = sections[sections.length - 1];
    if (last && last.title.en === head.en) last.rows.push(o);
    else sections.push({ title: head, rows: [o] });
  }
  return sections;
}

/** The list's headings: days for newest/oldest, the tab's name by status, the payment state's by payment. */
export function listSections(
  rows: readonly OrderListRow[],
  sort: SortBy,
  now: number,
): { title: Phrase; rows: OrderListRow[] }[] {
  if (sort === "status") {
    return groupBy(rows, (o) => ORDER_TABS[tabRank(o)]?.label ?? OTHER);
  }
  if (sort === "payment") {
    return groupBy(rows, (o) => PAY_FILTERS[payRank(o)]?.label ?? OTHER);
  }
  return daySections(rows, now);
}

/** "07/10/26 · 09:05" — when an order was placed or a step happened (the web's format). */
export function stamp(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} · ${clockTime(ms)}`;
}
