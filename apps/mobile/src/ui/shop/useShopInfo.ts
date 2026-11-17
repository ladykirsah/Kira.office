import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchShop, fetchShopInfo } from "@/lib/shopInfoApi";
import type { ShopIdentity, ShopInfo, ShopProfile } from "@/lib/shopInfoPage";
import { useAuth } from "../AppProviders";

const TOAST_MS = 3000;

/**
 * Each card's saved details, fresh every time the page comes back into view, and the page's toast.
 * Plan 10.3: only the cards this shop has — Den Air its counter + AirPlus, any other shop its counter.
 */
export function useShopInfo(profiles: readonly ShopProfile[]) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [shop, setShop] = useState<ShopIdentity | null>(null);
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
      const own = await fetchShop(fetch, API_BASE, token);
      const wanted = (key.split(",") as ShopProfile[]).filter((p) => own.profiles.includes(p));
      const read = await Promise.all(wanted.map((p) => fetchShopInfo(fetch, API_BASE, token, p)));
      setShop(own);
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

  return { token, shop, shops, failed, load, update, toast, showToast };
}
