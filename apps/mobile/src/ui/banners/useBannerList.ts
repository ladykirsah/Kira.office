import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { moved, orderPatches, slotRows, type Banner, type BannerSlot } from "@/lib/bannerPage";
import { fetchBanners, reorderBanners } from "@/lib/bannersApi";
import { API_BASE } from "@/lib/config";
import { oneAtATime } from "@/lib/oneAtATime";
import { useAuth } from "../AppProviders";
import { takeToast } from "./parts";

const TOAST_MS = 3000;

/**
 * What แบนเนอร์ reads: every banner, fresh each time the page comes back into view (after a save or a
 * delete), with any message the form left for it. ▲ / ▼ move a row at once and save behind it.
 */
export function useBannerList() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saves] = useState(oneAtATime);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setBanners(await fetchBanners(fetch, API_BASE, token));
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

  /**
   * ▲ / ▼: the new order shows at once and saves behind it, one move after another (two quick taps
   * never cross). When the last move is saved, or one fails, the list reads back what is really saved.
   */
  const move = (slot: BannerSlot, index: number, step: -1 | 1) => {
    if (!banners) return;
    const order = moved(slotRows(banners, slot), index, step);
    const patches = orderPatches(order);
    if (patches.length === 0) return;
    const placed = new Map(order.map((b, i) => [b.id, i]));
    setBanners(banners.map((b) => (placed.has(b.id) ? { ...b, sortOrder: placed.get(b.id)! } : b)));
    void saves
      .run(() => reorderBanners(fetch, API_BASE, token, patches))
      .catch((e: unknown) => {
        const why = e instanceof Error ? e.message : "";
        showToast(
          { th: "เลื่อนไม่สำเร็จ", en: "Not moved" },
          { th: why || "ลองอีกครั้ง", en: why || "Try again" },
        );
      })
      .finally(() => {
        if (saves.idle()) void load();
      });
  };

  return { banners, failed, load, toast, showToast, move };
}
