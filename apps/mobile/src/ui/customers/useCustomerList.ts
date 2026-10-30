import type { Phrase } from "@l-shopee/shared/lang";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import {
  fetchAccounts,
  fetchCarList,
  fetchSummary,
  recalcAllCredit,
  type AccountRow,
  type CarRow,
  type CustomerSummary,
} from "@/lib/customersApi";
import { readShopAccounts } from "@/lib/posApi";
import { useAuth } from "../AppProviders";

export type Side = "shop" | "airplus";

const SEARCH_WAIT_MS = 250;
const TOAST_MS = 3500;

/** What the ลูกค้า list remembers: which side, what was typed, the counts and the rows. */
export function useCustomerList() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [side, setSide] = useState<Side>("shop");
  const [q, setQ] = useState("");
  const [cars, setCars] = useState<CarRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [summary, setSummary] = useState<Record<Side, CustomerSummary | null>>({
    shop: null,
    airplus: null,
  });
  const [shopName, setShopName] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ title, detail });
    toastTimer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    const [shop, airplus, name] = await Promise.allSettled([
      fetchSummary(fetch, API_BASE, token, "shop"),
      fetchSummary(fetch, API_BASE, token, "airplus"),
      readShopAccounts(fetch, API_BASE, token),
    ]);
    setSummary({
      shop: shop.status === "fulfilled" ? shop.value : null,
      airplus: airplus.status === "fulfilled" ? airplus.value : null,
    });
    if (name.status === "fulfilled") setShopName(name.value.name);
  }, [token]);

  const loadRows = useCallback(
    async (which: Side, text: string) => {
      if (!token) return;
      try {
        if (which === "shop") setCars(await fetchCarList(fetch, API_BASE, token, text));
        else setAccounts(await fetchAccounts(fetch, API_BASE, token, text));
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Typing waits a moment so each key does not ask the server.
  useEffect(() => {
    const timer = setTimeout(() => void loadRows(side, q), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [side, q, loadRows]);

  const switchSide = (next: Side) => {
    setSide(next);
    setQ("");
  };

  const reload = useCallback(async () => {
    await Promise.all([loadSummary(), loadRows(side, q)]);
  }, [loadSummary, loadRows, side, q]);

  /** อัปเดตเครดิตทั้งหมด. */
  const recalc = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await recalcAllCredit(fetch, API_BASE, token);
      showToast(
        { th: "อัปเดตเครดิตแล้ว", en: "Credit updated" },
        { th: "ทุกบัญชีใช้กติกาปัจจุบันแล้ว", en: "Every account uses today's rules" },
      );
      await loadRows("airplus", q);
    } catch {
      showToast(
        { th: "อัปเดตเครดิตไม่สำเร็จ", en: "Credit was not updated" },
        { th: "ลองอีกครั้ง", en: "Try again" },
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    token,
    side,
    switchSide,
    q,
    setQ,
    cars,
    accounts,
    summary: summary[side],
    shopName,
    failed,
    reload,
    recalc,
    toast,
    showToast,
  };
}

export type CustomerList = ReturnType<typeof useCustomerList>;
