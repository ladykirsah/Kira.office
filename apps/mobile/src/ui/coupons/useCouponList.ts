import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Coupon } from "@/lib/couponPage";
import { fetchCoupons } from "@/lib/couponsApi";
import { API_BASE } from "@/lib/config";
import { useAuth } from "../AppProviders";

const TOAST_MS = 3000;

/** What คูปอง and one coupon's page read: every coupon, fresh each time the page comes back into view. */
export function useCouponList() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
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
      setCoupons(await fetchCoupons(fetch, API_BASE, token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return { token, coupons, failed, load, toast, showToast };
}
