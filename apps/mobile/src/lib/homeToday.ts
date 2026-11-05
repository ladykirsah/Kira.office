import type { Phrase } from "@l-shopee/shared/lang";
import { navGroupsFor } from "@l-shopee/shared/nav";
import {
  billTotals,
  changeLine,
  expenseSum,
  expensesIn,
  financeOrders,
  inRange,
  orderTotals,
  periodRange,
  previousRange,
  type Bill,
  type Expense,
  type MoneyOrder,
  type Range,
} from "./financePage";
import type { StaffRole } from "./signIn";

/**
 * หน้าหลัก on a computer (DeskHome board, 4 Nov 2026): a row of shortcuts and, for the owner, a
 * "วันนี้" card with today's money, added up the way การเงิน adds it up. Words and sums only.
 */

/** The shortcut row, in the drawing's order; ทำบิล is the red one. */
const QUICK = ["/pos", "/scan", "/products/new", "/barcodes"] as const;

/** The shortcuts this role's menu has, in the menu's own words. */
export function quickLinks(role: StaffRole): { href: string; label: Phrase }[] {
  const links = navGroupsFor(role).flatMap((g) => g.links);
  return QUICK.flatMap((href) => {
    const link = links.find((l) => l.href === href);
    return link ? [{ href, label: link.label }] : [];
  });
}

type Change = { arrow: string; tone: "good" | "bad" } | null;

/** One day's money across both shops: done bills, AirPlus orders that moved money, less expenses. */
function dayMoney(
  bills: readonly Bill[],
  orders: readonly MoneyOrder[],
  expenses: readonly Expense[],
  r: Range,
) {
  const den = billTotals(bills.filter((b) => inRange(b.createdAt, r)));
  const air = orderTotals(financeOrders(orders, r));
  const cost = expenseSum(expensesIn(expenses, null, r));
  return {
    salesSatang: den.revenueSatang + air.revenueSatang,
    profitSatang: den.profitSatang + air.profitSatang - cost,
    count: { den: den.count, air: air.count },
  };
}

/**
 * The owner's วันนี้ card: ยอดขาย, กำไร and บิล for today, each against the whole of yesterday
 * (การเงิน's วันนี้ compares the same way). No change line when yesterday had nothing.
 */
export function todaySummary(input: {
  billsToday: readonly Bill[];
  billsYesterday: readonly Bill[];
  orders: readonly MoneyOrder[];
  expenses: readonly Expense[];
  now: number;
}) {
  const today = periodRange("today", null, input.now);
  const yesterday = previousRange(today, "today")!;
  const now = dayMoney(input.billsToday, input.orders, input.expenses, today);
  const before = dayMoney(input.billsYesterday, input.orders, input.expenses, yesterday);
  const change = (a: number, b: number): Change => changeLine(a, b);
  return {
    ...now,
    salesChange: change(now.salesSatang, before.salesSatang),
    profitChange: change(now.profitSatang, before.profitSatang),
  };
}

/** "เด่นแอร์ 5 · AirPlus 8" — the counter's bills first (owner: the counter is เด่นแอร์). */
export const billCountLine = (c: { den: number; air: number }): Phrase => ({
  th: `เด่นแอร์ ${c.den} · AirPlus ${c.air}`,
  en: `Den Air ${c.den} · AirPlus ${c.air}`,
});

const HOUR = 60 * 60 * 1000;

/** Money in, added up hour by hour: hours 0 … `hours - 1` of the day that starts at `dayStart`. */
function addedUp(
  points: readonly { at: number; revenue: number }[],
  dayStart: number,
  hours: number,
) {
  const perHour = Array.from({ length: hours }, () => 0);
  for (const p of points) {
    const h = Math.floor((p.at - dayStart) / HOUR);
    if (h >= 0 && h < hours) perHour[h] += p.revenue;
  }
  let sum = 0;
  return perHour.map((v) => (sum += v));
}

/** The วันนี้ card's line: today up to this hour, and yesterday's whole day dashed behind it. */
export function todayCurve(
  today: readonly { at: number; revenue: number }[],
  yesterday: readonly { at: number; revenue: number }[],
  now: number,
) {
  const start = periodRange("today", null, now).from;
  const thisHour = Math.floor((now - start) / HOUR);
  return {
    today: addedUp(today, start, thisHour + 1),
    yesterday: addedUp(yesterday, start - 24 * HOUR, 24),
  };
}

/** The วันนี้ card is money: only whoever has การเงิน in their menu sees it (today: the owner). */
export const seesMoney = (role: StaffRole): boolean =>
  navGroupsFor(role).some((g) => g.links.some((l) => l.href === "/sales"));
