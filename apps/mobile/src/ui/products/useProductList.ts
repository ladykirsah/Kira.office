import type { Phrase } from "@l-shopee/shared/lang";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { OLD_BACK_OFFICE, addProductPage } from "@/lib/oldBackOffice";
import {
  NO_FILTERS,
  tabCounts,
  visibleRows,
  type ProductFilters,
  type ProductRow,
  type ProductSort,
  type ProductTab,
} from "@/lib/productList";
import { nameLabel } from "@/lib/productPickers";
import { fetchAttributes, fetchProductRows, findByCode, type Attributes } from "@/lib/productsApi";
import { useAuth, useLang } from "../AppProviders";
import { openPage } from "../openPage";
import { useRights } from "./useRights";

const TOAST_MS = 3000;

export type ListSheet = "brand" | "system" | "car" | "scan" | null;

/** What สินค้า's list remembers: the catalogue, the tab, what is typed and picked, and the sheets. */
export function useProductList() {
  const auth = useAuth();
  const { t } = useLang();
  const token = auth.status === "signed-in" ? auth.token : "";
  const rights = useRights();
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<ProductTab>("all");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<ProductFilters>(NO_FILTERS);
  const [sort, setSort] = useState<ProductSort>("updated");
  const [sheet, setSheet] = useState<ListSheet>(null);
  const [stockFor, setStockFor] = useState<ProductRow | null>(null);
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
      const [list, lists] = await Promise.all([
        fetchProductRows(fetch, API_BASE, token),
        fetchAttributes(fetch, API_BASE, token),
      ]);
      setRows(list);
      setAttrs(lists);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  // Coming back from a product page or its edit shows what was just saved.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** What people read for a brand, system or part name the rows carry by identity. */
  const label = (kind: keyof Attributes, name: string): string =>
    t(nameLabel(attrs?.[kind] ?? [], name));

  const copy = (code: string) => {
    void globalThis.navigator?.clipboard?.writeText(code);
    showToast({ th: `คัดลอก ${code} แล้ว`, en: `${code} copied` });
  };

  /** A scanned code opens its product; an unknown one becomes the search, which offers to add it. */
  const scanned = async (code: string) => {
    setSheet(null);
    try {
      const id = await findByCode(fetch, API_BASE, token, code);
      if (id) router.push(`/products/${encodeURIComponent(id)}` as never);
      else setQ(code.trim());
    } catch {
      showToast(
        { th: "ค้นรหัสไม่ได้", en: "The code could not be looked up" },
        { th: "ลองอีกครั้ง", en: "Try again" },
      );
    }
  };

  /** เพิ่มสินค้า is still the old back office's page (not rebuilt yet), with a searched code filled in. */
  const addProduct = (code: string) => {
    const url = code ? addProductPage(OLD_BACK_OFFICE, code) : `${OLD_BACK_OFFICE}/products/new`;
    if (!openPage(url)) {
      showToast(
        { th: "เปิดหน้าใหม่ไม่ได้", en: "The page did not open" },
        { th: "อนุญาตให้เปิดหน้าต่างใหม่ แล้วลองอีกครั้ง", en: "Allow pop-ups and try again" },
      );
    }
  };

  const shown = rows ? visibleRows(rows, { tab, q, filters, sort }) : null;
  return {
    rights,
    rows,
    shown,
    counts: rows ? tabCounts(rows) : null,
    attrs,
    failed,
    load,
    tab,
    setTab,
    q,
    setQ,
    filters,
    setFilters,
    sort,
    setSort,
    sheet,
    setSheet,
    stockFor,
    setStockFor,
    toast,
    showToast,
    label,
    copy,
    scanned,
    addProduct,
  };
}

export type ProductList = ReturnType<typeof useProductList>;
