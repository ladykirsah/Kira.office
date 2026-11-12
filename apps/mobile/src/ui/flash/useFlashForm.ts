import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { createSale, fetchSales, updateSale } from "@/lib/flashApi";
import {
  createBody,
  editBody,
  emptyForm,
  formOf,
  formProblems,
  lineOf,
  type FlashForm,
  type FlashSale,
} from "@/lib/flashPage";
import type { ProductRow } from "@/lib/productList";
import { fetchProductRows } from "@/lib/productsApi";
import { useAuth } from "../AppProviders";
import { leaveToast } from "../affiliate/parts";
import { FLASH_BASE } from "./parts";

const TOAST_MS = 3000;

/** What is open over the form: ช่วงเวลา, เพิ่มสินค้า, or ราคาลด for a product picked or on the form. */
export type FlashSheet =
  | { kind: "when" }
  | { kind: "add" }
  | { kind: "price"; row: ProductRow }
  | { kind: "line"; index: number };

/**
 * One form for แคมเปญใหม่ and แก้แคมเปญ (canvas v259). A sale needs a name, its dates and at least
 * one product; บันทึก names only what is still empty, under each box, and saves the sale and every
 * product together. A new sale then opens its own page with สร้างแคมเปญแล้ว.
 */
export function useFlashForm(id: string | null) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [form, setForm] = useState<FlashForm | null>(id ? null : emptyForm());
  const [old, setOld] = useState<FlashSale | null>(null);
  const [problem, setProblem] = useState<"gone" | "failed" | null>(null);
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [productsFailed, setProductsFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<FlashSheet | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
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
      const s = (await fetchSales(fetch, API_BASE, token)).find((x) => x.id === id);
      if (!s) return setProblem("gone");
      setOld(s);
      setForm(formOf(s));
      setProblem(null);
    } catch {
      setProblem("failed");
    }
  }, [token, id]);

  // The catalogue: what เพิ่มสินค้า lists, and each product's cost for the ราคาลด sheet.
  const loadProducts = useCallback(async () => {
    if (!token) return;
    try {
      // One row per size: each size goes on sale at its own price (7 Nov 2026).
      setProducts(await fetchProductRows(fetch, API_BASE, token, { bySize: true }));
      setProductsFailed(false);
    } catch {
      setProductsFailed(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const set = (patch: Partial<FlashForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const addLine = (row: ProductRow, sale: string, cap: string) => {
    setForm((f) => (f ? { ...f, lines: [...f.lines, lineOf(row, sale, cap)] } : f));
    setSheet(null);
  };

  const changeLine = (index: number, sale: string, cap: string) => {
    setForm((f) =>
      f ? { ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, sale, cap } : l)) } : f,
    );
    setSheet(null);
  };

  const removeLine = (index: number) =>
    setForm((f) => (f ? { ...f, lines: f.lines.filter((_, i) => i !== index) } : f));

  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace((id ? `${FLASH_BASE}/${encodeURIComponent(id)}` : FLASH_BASE) as never);

  const errors = form && tried ? formProblems(form) : {};

  const save = async () => {
    if (!form || busy) return;
    setTried(true);
    if (Object.keys(formProblems(form)).length > 0) return;
    setBusy(true);
    try {
      if (id && old) {
        await updateSale(fetch, API_BASE, token, id, editBody(form, old));
        return leave();
      }
      const made = await createSale(fetch, API_BASE, token, createBody(form));
      leaveToast({ title: { th: "สร้างแคมเปญแล้ว", en: "Sale made" }, detail: { th: "", en: "" } });
      router.replace(`${FLASH_BASE}/${encodeURIComponent(made)}` as never);
    } catch (e) {
      const why = e instanceof Error ? e.message : "";
      showToast(
        { th: "บันทึกไม่สำเร็จ", en: "Not saved" },
        { th: why || "ลองอีกครั้ง", en: why || "Try again" },
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    isNew: !id,
    form,
    problem,
    errors,
    products,
    productsFailed,
    reloadProducts: loadProducts,
    query,
    setQuery,
    sheet,
    setSheet,
    toast,
    set,
    addLine,
    changeLine,
    removeLine,
    save,
    leave,
    reload: load,
  };
}

export type FlashFormState = ReturnType<typeof useFlashForm>;
