import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import type { ProductDetail } from "@/lib/productEdit";
import { nameLabel } from "@/lib/productPickers";
import { fetchAttributes, fetchProductDetail, type Attributes } from "@/lib/productsApi";
import { useAuth, useLang } from "../AppProviders";
import { useRights } from "./useRights";

const TOAST_MS = 3000;

/** One product, read fresh each time its page comes back into view (after แก้ไข saves). */
export function useProductPage(id: string) {
  const auth = useAuth();
  const { t } = useLang();
  const token = auth.status === "signed-in" ? auth.token : "";
  const rights = useRights();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  /** "gone": deleted elsewhere; "failed": did not load. */
  const [problem, setProblem] = useState<"gone" | "failed" | null>(null);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [d, lists] = await Promise.all([
        fetchProductDetail(fetch, API_BASE, token, id),
        fetchAttributes(fetch, API_BASE, token),
      ]);
      setDetail(d);
      setAttrs(lists);
      setProblem(d ? null : "gone");
    } catch {
      setProblem("failed");
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const label = (kind: keyof Attributes, name: string | null): string =>
    t(nameLabel(attrs?.[kind] ?? [], name));

  const copy = (code: string) => {
    void globalThis.navigator?.clipboard?.writeText(code);
    showToast({ th: `คัดลอก ${code} แล้ว`, en: `${code} copied` });
  };

  return { token, rights, detail, problem, load, label, copy, toast, showToast };
}

export type ProductPage = ReturnType<typeof useProductPage>;
