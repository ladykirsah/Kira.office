import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { fetchAffiliate, updateItem } from "@/lib/affiliateApi";
import type { AffiliateCategory, AffiliateItem } from "@/lib/affiliatePage";
import { API_BASE } from "@/lib/config";
import { useAuth } from "../AppProviders";
import { takeToast } from "./parts";

const TOAST_MS = 3000;

/**
 * What สินค้านายหน้า and ยังไม่จัดหมวด read: every card and the categories, fresh each time the page
 * comes back into view (after a save), with any message the form left for it.
 */
export function useAffiliateList() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [items, setItems] = useState<AffiliateItem[] | null>(null);
  const [categories, setCategories] = useState<AffiliateCategory[]>([]);
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
      const out = await fetchAffiliate(fetch, API_BASE, token);
      setItems(out.items);
      setCategories(out.categories);
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

  /** ยังไม่จัดหมวด's เลือกหมวด: file one card, then say where it went (it leaves the list). */
  const fileUnder = async (item: AffiliateItem, category: AffiliateCategory) => {
    try {
      await updateItem(fetch, API_BASE, token, item.id, { categoryId: category.id });
      setItems((all) =>
        (all ?? []).map((i) =>
          i.id === item.id ? { ...i, categoryId: category.id, categoryName: category.name } : i,
        ),
      );
      showToast({
        th: `ย้าย ${item.title} ไป ${category.name} แล้ว`,
        en: `${item.title} moved to ${category.name}`,
      });
    } catch (e) {
      const why = e instanceof Error ? e.message : "";
      showToast(
        { th: "ย้ายไม่สำเร็จ", en: "Not moved" },
        { th: why || "ลองอีกครั้ง", en: why || "Try again" },
      );
    }
  };

  const addCategory = (category: AffiliateCategory) =>
    setCategories((all) => (all.some((c) => c.id === category.id) ? all : [...all, category]));

  return { token, items, categories, failed, load, toast, showToast, fileUnder, addCategory };
}

export type AffiliateList = ReturnType<typeof useAffiliateList>;
