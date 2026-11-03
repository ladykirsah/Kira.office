import type { Phrase } from "@l-shopee/shared/lang";
import type { Range } from "./financePage";
import { niceMax } from "./insightChart";
import { MONTHS_EN, MONTHS_TH, shortDate, startOfDay, type DatePreset } from "./orderList";

/**
 * การเงิน's graph (canvas v297): a line graph under รายได้ / กำไร that follows the period picked
 * (owner, 2 Nov: "based on time selection", then "i want line graph").
 *   วันนี้ → by hour · 7 / 30 วัน, เดือนก่อน → by day · เดือนนี้ → added up against last month ·
 *   ทุกวัน → by month · กำหนดเอง → by its length (1 day / 2 months / 6 months / longer).
 * Profit is after expenses, so a day with a big bill to pay can go below zero.
 */

export type Step = "hour" | "day" | "week" | "month";

/** One amount on the graph: a bill or an order (money in, its profit) or an expense (−profit). */
export interface Money {
  at: number;
  revenue: number;
  profit: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function graphStep(preset: DatePreset, r: Range): Step | "running" {
  if (preset === "today") return "hour";
  if (preset === "month") return "running";
  if (preset === "all") return "month";
  const length = r.to - r.from;
  if (length <= DAY) return "hour";
  if (length <= 62 * DAY) return "day";
  if (length <= 186 * DAY) return "week";
  return "month";
}

const nextStart = (t: number, step: Step): number => {
  const d = new Date(t);
  if (step === "hour") return t + HOUR;
  if (step === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  if (step === "week") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
};

/** Where each point starts, from the period's first day (or month) up to its end. */
export function graphStarts(step: Step, r: Range): number[] {
  const first = new Date(r.from);
  let t =
    step === "month"
      ? new Date(first.getFullYear(), first.getMonth(), 1).getTime()
      : startOfDay(r.from);
  const out: number[] = [];
  while (t < r.to) {
    out.push(t);
    t = nextStart(t, step);
  }
  return out;
}

/** Each point's money in, and its profit after that point's expenses. */
export function graphSeries(entries: readonly Money[], starts: readonly number[], end: number) {
  const revenue = starts.map(() => 0);
  const profit = starts.map(() => 0);
  for (const e of entries) {
    if (e.at < (starts[0] ?? end) || e.at >= end) continue;
    let i = starts.length - 1;
    while (i > 0 && starts[i]! > e.at) i--;
    revenue[i] += e.revenue;
    profit[i] += e.profit;
  }
  return { revenue, profit };
}

/** One scale for both lines; below zero only as far as a loss needs. */
export function graphScale(series: readonly (readonly number[])[]): { min: number; max: number } {
  const all = series.flat();
  const lowest = Math.min(0, ...all);
  return { min: lowest < 0 ? -niceMax([-lowest]) : 0, max: niceMax(all) };
}

/** The number in the graph's top corner: the scale's top, or none while nothing is above zero. */
export function graphTop(max: number, series: readonly (readonly number[])[]): number | null {
  return series.some((s) => s.some((v) => v > 0)) ? max : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "ต.ค. 2569" / "Oct 2026". */
const monthYear = (ms: number): Phrase => {
  const d = new Date(ms);
  return {
    th: `${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`,
    en: `${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`,
  };
};

/** What a tap reads on the graph's top line: "11:00", "28 ต.ค.", "22–28 ต.ค.", "ต.ค. 2569". */
export function stepTitle(start: number, step: Step, end: number): Phrase {
  if (step === "hour") {
    const text = `${pad(new Date(start).getHours())}:00`;
    return { th: text, en: text };
  }
  if (step === "day") return shortDate(start);
  if (step === "month") return monthYear(start);
  const last = Math.min(nextStart(start, "week"), end) - 1;
  const a = shortDate(start);
  const b = shortDate(last);
  if (new Date(start).getMonth() === new Date(last).getMonth()) {
    const day = new Date(start).getDate();
    return { th: `${day}–${b.th}`, en: `${day}–${b.en}` };
  }
  return { th: `${a.th}–${b.th}`, en: `${a.en}–${b.en}` };
}

/** The labels along the bottom; days show their month at the two ends. */
export function graphTicks(starts: readonly number[], step: Step, now: number) {
  const n = starts.length;
  // Seven points or fewer are each named; more get five, evenly spaced.
  const k = n <= 7 ? n : 5;
  const picks =
    k <= 1 ? [0] : Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)));
  const thisYear = new Date(now).getFullYear();
  return [...new Set(picks)].map((index) => {
    const t = starts[index]!;
    const d = new Date(t);
    let label: Phrase;
    if (step === "hour") {
      const text = `${pad(d.getHours())}:00`;
      label = { th: text, en: text };
    } else if (step === "month") {
      const yy = d.getFullYear() === thisYear ? null : d.getFullYear();
      label = {
        th:
          yy === null
            ? MONTHS_TH[d.getMonth()]!
            : `${MONTHS_TH[d.getMonth()]} ${String(yy + 543).slice(2)}`,
        en:
          yy === null
            ? MONTHS_EN[d.getMonth()]!
            : `${MONTHS_EN[d.getMonth()]} ${String(yy).slice(2)}`,
      };
    } else if (step === "day" && index !== 0 && index !== n - 1) {
      label = { th: String(d.getDate()), en: String(d.getDate()) };
    } else {
      label = shortDate(t);
    }
    return { index, label };
  });
}

/** เดือนนี้: income added up day by day to today, last month's the same way, and the gap today. */
export function runningTotals(
  thisMonth: readonly Money[],
  lastMonth: readonly Money[],
  now: number,
) {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const prevDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const added = (entries: readonly Money[], from: Date, count: number) => {
    const perDay = Array.from({ length: count }, () => 0);
    for (const e of entries) {
      const d = new Date(e.at);
      if (d.getFullYear() !== from.getFullYear() || d.getMonth() !== from.getMonth()) continue;
      if (d.getDate() <= count) perDay[d.getDate() - 1] += e.revenue;
    }
    let sum = 0;
    return perDay.map((v) => (sum += v));
  };
  const nowLine = added(thisMonth, start, today.getDate());
  const before = added(lastMonth, prevStart, prevDays);
  const ahead = nowLine[nowLine.length - 1]! - before[Math.min(today.getDate(), prevDays) - 1]!;
  return { days, now: nowLine, before, ahead };
}

/**
 * The graph's points, counted the way รายได้ and กำไร are: completed bills (a refunded bill is not
 * income), orders where money moved (with their own sales and profit), and expenses lowering profit.
 * The caller passes only what is in the period and the shop.
 */
export function moneyOf(
  bills: readonly {
    createdAt: number;
    saleStatus: string;
    grandTotalSatang: number;
    grossProfitSatang: number;
  }[],
  orders: readonly { at: number; salesSatang?: number | null; profitSatang?: number | null }[],
  expenses: readonly { occurredAt: number; amountSatang: number }[],
): Money[] {
  return [
    ...bills
      .filter((b) => b.saleStatus === "completed")
      .map((b) => ({ at: b.createdAt, revenue: b.grandTotalSatang, profit: b.grossProfitSatang })),
    ...orders.map((o) => ({ at: o.at, revenue: o.salesSatang ?? 0, profit: o.profitSatang ?? 0 })),
    ...expenses.map((e) => ({ at: e.occurredAt, revenue: 0, profit: -e.amountSatang })),
  ];
}
