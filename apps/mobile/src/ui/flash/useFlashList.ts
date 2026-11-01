import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchSales } from "@/lib/flashApi";
import type { FlashSale } from "@/lib/flashPage";
import { useAuth } from "../AppProviders";
import { takeToast } from "../affiliate/parts";

const TOAST_MS = 3000;

/**
 * What แฟลชเซล and one sale's page read: every sale with its products, fresh each time the page
 * comes back into view, and the message a form left behind (สร้างแคมเปญแล้ว).
 */
export function useFlashList() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [sales, setSales] = useState<FlashSale[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setSales(await fetchSales(fetch, API_BASE, token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      const left = takeToast();
      if (left) showToast(left.title, left.detail);
      void load();
    }, [load, showToast]),
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return { token, sales, failed, load, toast, showToast };
}
