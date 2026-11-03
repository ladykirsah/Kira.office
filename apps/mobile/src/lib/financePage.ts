import { operationalStatus } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import { bahtText } from "./flashPage";
import {
  dateRange,
  placedAt,
  shortDate,
  startOfDay,
  type CustomRange,
  type DatePreset,
  type OrderListRow,
} from "./orderList";

/**
 * การเงิน (canvas v294): the two shops' money for a period — Den Air Service's bills, AirPlus's
 * orders where money moved, and the expenses booked against each. The numbers follow the old
 * finance page (apps/admin/src/app/sales) so the two never disagree.
 */

/** The expenses table's channel names: onsite = Den Air Service, airplus = AirPlus. */
export type Shop = "onsite" | "airplus";

export const SHOP_NAME: Record<Shop, string> = { onsite: "Den Air Service", airplus: "AirPlus" };

/** [from, to) in ms — what GET /sales?from&to takes. */
export interface Range {
  from: number;
  to: number;
}

/** One Den Air Service bill (GET /sales). */
export interface Bill {
  id: string;
  saleNumber: string | null;
  grandTotalSatang: number;
  saleStatus: string;
  createdAt: number;
  /** "parts" (สินค้า) or "repair" (บริการ). */
  saleType: string | null;
  licensePlate: string | null;
  vehicle: string | null;
  /** The plate's province, kept on the car's customer record — part of the plate. */
  plateProvince: string | null;
  buyerName: string | null;
  grossProfitSatang: number;
  /** Goods lines — what a refund puts back on the shelf. */
  partLineCount: number;
}

/** An AirPlus order as GET /orders sends it, with the money the server derives. */
export interface MoneyOrder extends OrderListRow {
  salesSatang?: number | null;
  profitSatang?: number | null;
}

export interface Expense {
  id: string;
  channel: Shop;
  /** The owner's own words for it — "รายการ" on the form. */
  conversion: string;
  amountSatang: number;
  note: string | null;
  occurredAt: number;
  createdAt: number;
  /** A slip is kept; the picture is GET /finance/expenses/:id/slip. */
  hasSlip: boolean;
}

/** The add / edit form, as typed. */
export interface ExpenseDraft {
  name: string;
  amount: string;
  channel: Shop;
  day: number;
  note: string;
}

/** "฿312,600" — commas, no .00; a loss "−฿2,140". */
export const money = (satang: number) =>
  satang < 0 ? `−฿${bahtText(-satang)}` : `฿${bahtText(satang)}`;

/** "−฿3,850" — an expense, with a real minus sign. */
export const minus = (satang: number) => `−${money(satang)}`;

/** The period a date choice covers, as the server takes it. ทุกวัน starts at the very beginning. */
export function periodRange(preset: DatePreset, custom: CustomRange | null, now: number): Range {
  const { start, end } = dateRange(preset, custom, now);
  return {
    from: Number.isFinite(start) ? start : 0,
    to: Number.isFinite(end) ? end + 1 : now + 1,
  };
}

/**
 * What "▲9% จากช่วงก่อนหน้า" compares with: เดือนนี้ against last month up to the same day and
 * time (the graph's "นำเดือนก่อน" says the same), เดือนก่อน against the whole month before it, and
 * every other period against the same length right before. ทุกวัน has nothing before it.
 */
export function previousRange(r: Range, preset: DatePreset): Range | null {
  if (r.from <= 0) return null;
  const start = new Date(r.from);
  const monthBefore = new Date(start.getFullYear(), start.getMonth() - 1, 1).getTime();
  if (preset === "month") return { from: monthBefore, to: monthBefore + (r.to - r.from) };
  if (preset === "lastmonth") return { from: monthBefore, to: r.from };
  return { from: r.from - (r.to - r.from), to: r.from };
}

/** The change against the period before: green when up, red when down; none with nothing before. */
export function changeLine(
  current: number,
  previous: number | null,
): { arrow: string; tone: "good" | "bad" } | null {
  if (previous === null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0
    ? { arrow: `▲${pct}%`, tone: "good" }
    : { arrow: `▼${Math.abs(pct)}%`, tone: "bad" };
}

export const inRange = (ms: number, r: Range) => ms >= r.from && ms < r.to;

/** A refunded bill is not income; only completed bills count (the old page's summarize). */
export function billTotals(bills: readonly Bill[]) {
  const done = bills.filter((b) => b.saleStatus === "completed");
  const sum = (pick: (b: Bill) => number) => done.reduce((n, b) => n + pick(b), 0);
  return {
    count: done.length,
    revenueSatang: sum((b) => b.grandTotalSatang),
    profitSatang: sum((b) => b.grossProfitSatang),
  };
}

const same = (text: string): Phrase => ({ th: text, en: text });

/**
 * "1กก 1234 กรุงเทพมหานคร" — the plate with its province, never the car (owner, 2 Nov: "only keep
 * plate > remove model"); without a plate, who bought it, or a counter sale.
 */
export function billTitle(b: Bill): Phrase {
  if (b.licensePlate) return same([b.licensePlate, b.plateProvince].filter(Boolean).join(" "));
  if (b.buyerName) return same(b.buyerName);
  return { th: "ขายหน้าร้าน", en: "Counter sale" };
}

/** "DAS202610-29004" — the bill number; a record shows its day (the list's heading), never a time. */
export const billSub = (b: Bill) => b.saleNumber ?? "—";

export const billState = (b: Bill): Phrase | null =>
  b.saleStatus === "refunded" ? { th: "คืนเงินแล้ว", en: "Refunded" } : null;

const searchText = (query: string) => query.trim().toLowerCase().replace(/,/g, "");

const matches = (q: string, fields: readonly (string | null | undefined)[]) =>
  !q || fields.some((f) => Boolean(f) && f!.toLowerCase().includes(q));

/** The search box: what a row shows — plate and province, bill number, buyer — or the amount. */
export function searchBills(bills: readonly Bill[], query: string): Bill[] {
  const q = searchText(query);
  return bills.filter((b) =>
    matches(q, [
      b.licensePlate,
      b.plateProvince,
      b.saleNumber,
      b.buyerName,
      String(b.grandTotalSatang / 100),
    ]),
  );
}

/** Only orders where money has moved (the old page's rule): done, refunded, claimed, claim refused. */
const MONEY_MOVED = new Set(["complete", "refunded", "claimed", "claim_rejected"]);

export function financeOrders(orders: readonly MoneyOrder[], r: Range): MoneyOrder[] {
  return orders.filter((o) => {
    const s = operationalStatus(o.orderStatus, o.paymentStatus);
    return o.channel === "airplus" && s != null && MONEY_MOVED.has(s) && inRange(placedAt(o), r);
  });
}

export function orderTotals(orders: readonly MoneyOrder[]) {
  return {
    count: orders.length,
    revenueSatang: orders.reduce((n, o) => n + (o.salesSatang ?? 0), 0),
    profitSatang: orders.reduce((n, o) => n + (o.profitSatang ?? 0), 0),
  };
}

/** Said once, only when it isn't the usual (a done order says nothing). */
export function orderState(o: MoneyOrder): Phrase | null {
  switch (operationalStatus(o.orderStatus, o.paymentStatus)) {
    case "refunded":
      return { th: "คืนเงินแล้ว", en: "Refunded" };
    case "claimed":
      return { th: "เคลม", en: "Claimed" };
    case "claim_rejected":
      return { th: "ปฏิเสธการเคลม", en: "Claim refused" };
    default:
      return null;
  }
}

/** "AP-2006" — the order number; no time. */
export const orderSub = (o: MoneyOrder) => o.externalOrderId;

export function searchOrders(orders: readonly MoneyOrder[], query: string): MoneyOrder[] {
  const q = searchText(query);
  return orders.filter((o) =>
    matches(q, [
      o.externalOrderId,
      o.buyerUsername,
      String((o.salesSatang ?? o.grandTotalSatang) / 100),
    ]),
  );
}

const searchExpenses = (expenses: readonly Expense[], query: string) => {
  const q = searchText(query);
  return expenses.filter((e) => matches(q, [e.conversion, e.note, String(e.amountSatang / 100)]));
};

/** One row of a shop's list: money in (a bill or an order) or money out (an expense). */
export type LedgerRow =
  | { kind: "bill"; at: number; bill: Bill }
  | { kind: "order"; at: number; order: MoneyOrder }
  | { kind: "expense"; at: number; expense: Expense };

/**
 * A shop's list holds its money in and its money out together (owner, 2 Nov: "make sure the list
 * included both of income and expenses"), newest first. An expense is booked to its day, so it
 * comes after that day's bills.
 */
function ledger(rows: LedgerRow[], expenses: readonly Expense[], query: string): LedgerRow[] {
  const out = rows.concat(
    searchExpenses(expenses, query).map((expense) => ({
      kind: "expense" as const,
      at: expense.occurredAt,
      expense,
    })),
  );
  return out.sort((a, b) => b.at - a.at);
}

export const billRows = (bills: readonly Bill[], expenses: readonly Expense[], query: string) =>
  ledger(
    searchBills(bills, query).map((bill) => ({ kind: "bill" as const, at: bill.createdAt, bill })),
    expenses,
    query,
  );

export const orderRows = (
  orders: readonly MoneyOrder[],
  expenses: readonly Expense[],
  query: string,
) =>
  ledger(
    searchOrders(orders, query).map((order) => ({
      kind: "order" as const,
      at: placedAt(order),
      order,
    })),
    expenses,
    query,
  );

/** One shop's expenses (or both, with null) inside the period, newest first. */
export function expensesIn(expenses: readonly Expense[], shop: Shop | null, r: Range): Expense[] {
  return expenses
    .filter((e) => (shop === null || e.channel === shop) && inRange(e.occurredAt, r))
    .sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
}

export const expenseSum = (expenses: readonly Expense[]) =>
  expenses.reduce((n, e) => n + e.amountSatang, 0);

/** A day as a list shows it: "1 ต.ค."; another year carries its Thai year. */
function dayWords(ms: number, now: number): Phrase {
  const day = shortDate(ms);
  const year = new Date(ms).getFullYear();
  if (year === new Date(now).getFullYear()) return day;
  return { th: `${day.th} ${year + 543}`, en: `${day.en} ${year}` };
}

/** "AirPlus · 1 ต.ค.". */
export function expenseSub(e: Expense, now: number): Phrase {
  const day = dayWords(e.occurredAt, now);
  return { th: `${SHOP_NAME[e.channel]} · ${day.th}`, en: `${SHOP_NAME[e.channel]} · ${day.en}` };
}

/** Only the empty boxes are named, whatever order they were filled in. */
export function expenseProblems(d: ExpenseDraft): Partial<Record<"name" | "amount", Phrase>> {
  const out: Partial<Record<"name" | "amount", Phrase>> = {};
  if (!d.name.trim()) out.name = { th: "ยังไม่ได้ใส่รายการ", en: "Add what it was for" };
  const satang = Math.round(Number(d.amount.replace(/,/g, "")) * 100);
  if (!d.amount.trim() || !Number.isFinite(satang) || satang <= 0) {
    out.amount = { th: "ยังไม่ได้ใส่จำนวนเงิน", en: "Add the amount" };
  }
  return out;
}

/** What POST/PUT /finance/expenses takes. */
export function expenseBody(d: ExpenseDraft) {
  const note = d.note.trim();
  return {
    channel: d.channel,
    conversion: d.name.trim(),
    amountSatang: Math.round(Number(d.amount.replace(/,/g, "")) * 100),
    occurredAt: d.day,
    ...(note ? { note } : {}),
  };
}

/** A list's day heading: "วันนี้ · 29 ต.ค.", "เมื่อวาน · 28 ต.ค.", "20 ต.ค.". */
export function dayHeading(dayStart: number, now: number): Phrase {
  const day = dayWords(dayStart, now);
  const today = startOfDay(now);
  if (dayStart === today) return { th: `วันนี้ · ${day.th}`, en: `Today · ${day.en}` };
  if (dayStart === startOfDay(today - 1)) {
    return { th: `เมื่อวาน · ${day.th}`, en: `Yesterday · ${day.en}` };
  }
  return day;
}

/** Rows grouped under their day, in the order they come. */
export function byDay<T>(rows: readonly T[], when: (row: T) => number, now: number) {
  const out: { day: number; title: Phrase; rows: T[] }[] = [];
  for (const row of rows) {
    const day = startOfDay(when(row));
    const last = out[out.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else out.push({ day, title: dayHeading(day, now), rows: [row] });
  }
  return out;
}
