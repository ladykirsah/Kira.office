import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchShopInfo } from "@/lib/shopInfoApi";
import type { ShopInfo, ShopProfile } from "@/lib/shopInfoPage";
import { useAuth } from "../AppProviders";

const TOAST_MS = 3000;

/** The shops ข้อมูลร้าน shows, in card order. */
export const SHOP_ORDER: readonly ShopProfile[] = ["denair", "airplus"];

/** Each shop's saved details, fresh every time the page comes back into view, and the page's toast. */
export function useShopInfo(profiles: readonly ShopProfile[]) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [shops, setShops] = useState<Partial<Record<ShopProfile, ShopInfo>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = profiles.join(",");

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const wanted = key.split(",") as ShopProfile[];
      const read = await Promise.all(wanted.map((p) => fetchShopInfo(fetch, API_BASE, token, p)));
      setShops(Object.fromEntries(wanted.map((p, i) => [p, read[i]])));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token, key]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  /** After a save: the page shows what was saved without reading it all again. */
  const update = useCallback((profile: ShopProfile, patch: Partial<ShopInfo>) => {
    setShops((now) =>
      now?.[profile] ? { ...now, [profile]: { ...now[profile], ...patch } } : now,
    );
  }, []);

  return { token, shops, failed, load, update, toast, showToast };
}
