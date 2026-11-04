import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchShopeeWorklist, markShopeeSynced, type ShopeeWorkItem } from "@/lib/homeApi";
import { homeCounts, readTicked, stillTicked } from "@/lib/homePage";
import type { OrderTab } from "@/lib/orderList";
import { fetchOrders } from "@/lib/ordersApi";
import { readPref, writePref } from "../prefs";

/** This phone's ticks, kept until ล้างที่ทำแล้ว — leaving หน้าหลัก doesn't lose them (drawing's end card). */
const TICKS_KEY = "kira_shopee_ticked";

export interface Home {
  /** Null while loading or when the orders didn't load (the tiles then say —). */
  counts: Record<OrderTab, number> | null;
  /** Null until it loads, and when it didn't: "couldn't look" never shows as "nothing waiting". */
  items: ShopeeWorkItem[] | null;
  /** Something didn't load or ล้างที่ทำแล้ว didn't reach the server: the no-connection card. */
  offline: boolean;
  ticked: string[];
  toggle: (productId: string) => void;
  clearDone: () => void;
}

export function useHome(token: string | null): Home {
  const [counts, setCounts] = useState<Record<OrderTab, number> | null>(null);
  const [items, setItems] = useState<ShopeeWorkItem[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const clearing = useRef(false);

  const keep = useCallback((next: string[]) => {
    setTicked(next);
    void writePref(TICKS_KEY, JSON.stringify(next));
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    const [orders, work, saved] = await Promise.allSettled([
      fetchOrders(fetch, API_BASE, token),
      fetchShopeeWorklist(fetch, API_BASE, token),
      readPref(TICKS_KEY),
    ]);
    setCounts(orders.status === "fulfilled" ? homeCounts(orders.value, Date.now()) : null);
    setItems(work.status === "fulfilled" ? work.value : null);
    setOffline(orders.status === "rejected" || work.status === "rejected");
    if (work.status === "fulfilled") {
      const raw = saved.status === "fulfilled" ? saved.value : null;
      keep(stillTicked(readTicked(raw), work.value));
    }
  }, [token, keep]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = (productId: string) =>
    keep(
      ticked.includes(productId) ? ticked.filter((id) => id !== productId) : [...ticked, productId],
    );

  const clearDone = () => {
    if (!token || clearing.current || ticked.length === 0) return;
    clearing.current = true;
    const done = ticked;
    markShopeeSynced(fetch, API_BASE, token, done)
      .then(() => {
        setItems((list) => list && list.filter((i) => !done.includes(i.productId)));
        keep([]);
        setOffline(false);
      })
      .catch(() => setOffline(true))
      .finally(() => {
        clearing.current = false;
      });
  };

  return { counts, items, offline, ticked, toggle, clearDone };
}
