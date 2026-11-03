import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchBills, fetchExpenses, fetchMoneyOrders } from "@/lib/financeApi";
import { moneyOf } from "@/lib/financeChart";
import {
  billTotals,
  expenseSum,
  expensesIn,
  financeOrders,
  inRange,
  orderTotals,
  previousRange,
  type Bill,
  type Expense,
  type MoneyOrder,
  type Range,
  type Shop,
} from "@/lib/financePage";
import { placedAt, type DatePreset } from "@/lib/orderList";
import { useAuth } from "../AppProviders";

interface Books {
  key: string;
  bills: Bill[];
  before: Bill[];
  orders: MoneyOrder[];
  expenses: Expense[];
}

/**
 * Everything การเงิน shows for one period: the period's bills and the bills before it (for ▲/▼ —
 * for เดือนนี้ the whole of last month, which its graph draws dashed), every order, and every
 * expense. Read again whenever the page comes into view (back from a save).
 */
export function useBooks(range: Range, preset: DatePreset) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const key = `${preset}:${range.from}-${range.to}`;
  const [books, setBooks] = useState<Books | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    if (!token) return;
    const before = previousRange(range, preset === "month" ? "lastmonth" : preset);
    try {
      const [bills, prev, orders, expenses] = await Promise.all([
        fetchBills(fetch, API_BASE, token, range),
        before ? fetchBills(fetch, API_BASE, token, before) : Promise.resolve([]),
        fetchMoneyOrders(fetch, API_BASE, token),
        fetchExpenses(fetch, API_BASE, token),
      ]);
      setBooks({ key, bills, before: prev, orders, expenses });
      setFailed(false);
    } catch {
      setFailed(true);
    }
    // range is read through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return { books: books?.key === key ? books : null, failed, load };
}

/** Each shop's numbers for the period, the way the old finance page adds them up. */
export function shopNumbers(books: Books, range: Range, preset: DatePreset) {
  const before = previousRange(range, preset);
  const bills = billTotals(books.bills);
  const orders = financeOrders(books.orders, range);
  const air = orderTotals(orders);
  const denCost = expenseSum(expensesIn(books.expenses, "onsite", range));
  const airCost = expenseSum(expensesIn(books.expenses, "airplus", range));
  return {
    den: {
      ...bills,
      expenseSatang: denCost,
      netSatang: bills.profitSatang - denCost,
      previous: before
        ? billTotals(books.before.filter((b) => inRange(b.createdAt, before))).revenueSatang
        : null,
    },
    air: {
      ...air,
      orders,
      expenseSatang: airCost,
      netSatang: air.profitSatang - airCost,
      previous: before ? orderTotals(financeOrders(books.orders, before)).revenueSatang : null,
    },
  };
}

/**
 * The graph's points for one shop (or both, with null): this period's, and for เดือนนี้ last
 * month's money in, which its dashed line adds up.
 */
export function graphPoints(books: Books, range: Range, shop: Shop | null) {
  const asPoints = (orders: readonly MoneyOrder[]) =>
    orders.map((o) => ({
      at: placedAt(o),
      salesSatang: o.salesSatang,
      profitSatang: o.profitSatang,
    }));
  const bills = shop === "airplus" ? [] : books.bills;
  const orders = shop === "onsite" ? [] : financeOrders(books.orders, range);
  const lastMonth = previousRange(range, "lastmonth");
  return {
    points: moneyOf(bills, asPoints(orders), expensesIn(books.expenses, shop, range)),
    lastMonth: lastMonth
      ? moneyOf(
          shop === "airplus" ? [] : books.before,
          asPoints(shop === "onsite" ? [] : financeOrders(books.orders, lastMonth)),
          [],
        )
      : [],
  };
}
