import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchBills, fetchExpenses, fetchMoneyOrders } from "@/lib/financeApi";
import { moneyOf } from "@/lib/financeChart";
import { financeOrders, periodRange, previousRange } from "@/lib/financePage";
import { todayCurve, todaySummary } from "@/lib/homeToday";
import { placedAt } from "@/lib/orderList";

export type TodayMoney = ReturnType<typeof todaySummary> & {
  curve: ReturnType<typeof todayCurve>;
};

/**
 * The owner's วันนี้ card on a computer: today's and yesterday's bills, every order and expense —
 * the books การเงิน reads — added up for today. Null while loading or when it didn't load; nothing
 * is fetched for someone who doesn't see money (the API would refuse them anyway).
 */
export function useTodayMoney(token: string | null, enabled: boolean): TodayMoney | null {
  const [money, setMoney] = useState<TodayMoney | null>(null);
  const load = useCallback(async () => {
    if (!token || !enabled) return;
    const now = Date.now();
    const today = periodRange("today", null, now);
    const yesterday = previousRange(today, "today")!;
    try {
      const [billsToday, billsYesterday, orders, expenses] = await Promise.all([
        fetchBills(fetch, API_BASE, token, today),
        fetchBills(fetch, API_BASE, token, yesterday),
        fetchMoneyOrders(fetch, API_BASE, token),
        fetchExpenses(fetch, API_BASE, token),
      ]);
      const points = (bills: typeof billsToday, r: typeof today) =>
        moneyOf(
          bills,
          financeOrders(orders, r).map((o) => ({ ...o, at: placedAt(o) })),
          [],
        );
      setMoney({
        ...todaySummary({ billsToday, billsYesterday, orders, expenses, now }),
        curve: todayCurve(points(billsToday, today), points(billsYesterday, yesterday), now),
      });
    } catch {
      setMoney(null);
    }
  }, [token, enabled]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return money;
}
