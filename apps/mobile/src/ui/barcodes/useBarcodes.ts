import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { labelText, type LabelSize, type LabelText } from "@/lib/barcodeLabel";
import { readLabelShop } from "@/lib/barcodesApi";
import { API_BASE } from "@/lib/config";
import {
  addLabel,
  copiesOf,
  labelCount,
  removeLabel,
  setLabelQty,
  type SheetItem,
} from "@/lib/labelList";
import { planLabelPages, sheetSummary, type Paper, type PaperWay } from "@/lib/labelSheet";
import type { ProductRow } from "@/lib/productList";
import {
  fetchAttributes,
  fetchCarBrands,
  fetchProductRows,
  findByCode,
  type Attributes,
  type CarBrand,
} from "@/lib/productsApi";
import { useAuth } from "../AppProviders";
import type { LabelShop } from "./LabelArt";

const TOAST_MS = 3000;

export type FileKind = "pdf" | "png";

/** What is open over the page. */
export type BarcodeSheet =
  | null
  | { kind: "scan" }
  | { kind: "add"; productId?: string; query?: string; notFound?: string }
  | { kind: "label"; key: string }
  | { kind: "preview" };

/** A file being made: the whole sheet, or one label as a picture. */
export type PrintJob = { kind: "sheet"; file: FileKind } | { kind: "label"; key: string } | null;

/** ออกบาร์โค้ด's memory: the catalogue, the labels on the sheet, the paper and file, what is open. */
export function useBarcodes() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [cars, setCars] = useState<CarBrand[]>([]);
  const [shop, setShop] = useState<LabelShop>({ name: "", phone: "" });
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<SheetItem[]>([]);
  const [paper, setPaper] = useState<Paper>("A4");
  const [way, setWay] = useState<PaperWay>("portrait");
  const [file, setFile] = useState<FileKind>("pdf");
  const [sheet, setSheet] = useState<BarcodeSheet>(null);
  const [printing, setPrinting] = useState<PrintJob>(null);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [list, lists, brands, shopNow] = await Promise.all([
        fetchProductRows(fetch, API_BASE, token),
        fetchAttributes(fetch, API_BASE, token),
        fetchCarBrands(fetch, API_BASE, token),
        readLabelShop(fetch, API_BASE, token),
      ]);
      setRows(list);
      setAttrs(lists);
      setCars(brands);
      setShop(shopNow);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
  const texts = useMemo(() => {
    const out = new Map<string, LabelText>();
    if (attrs) for (const r of rows ?? []) out.set(r.id, labelText(r, attrs, cars));
    return out;
  }, [rows, attrs, cars]);
  /** Items whose product is still in the catalogue (one deleted on another phone drops out). */
  const shown = useMemo(() => items.filter((i) => texts.has(i.productId)), [items, texts]);
  /** One entry per printed label; its `index` on a page points back into this list. */
  const copies = useMemo(
    () => copiesOf(shown, (id) => texts.get(id)?.cars.length ?? 0),
    [shown, texts],
  );
  const pages = useMemo(() => planLabelPages(copies, paper, way), [copies, paper, way]);
  const count = labelCount(shown);

  /** A scanned code: its product opens the add sheet; an unknown code says so and offers to add it. */
  const scanned = async (code: string) => {
    const typed = code.trim();
    try {
      const id = await findByCode(fetch, API_BASE, token, typed);
      if (id && byId.has(id)) setSheet({ kind: "add", productId: id });
      else setSheet({ kind: "add", query: typed, notFound: typed });
    } catch {
      setSheet(null);
      showToast(
        { th: "ค้นรหัสไม่ได้", en: "The code could not be looked up" },
        { th: "ลองอีกครั้ง", en: "Try again" },
      );
    }
  };

  const add = (productId: string, size: LabelSize, qty: number) => {
    setItems((list) => addLabel(list, productId, size, qty));
    setSheet(null);
  };

  return {
    rows,
    attrs,
    shop,
    failed,
    load,
    items: shown,
    byId,
    texts,
    pages,
    copies,
    count,
    summary: sheetSummary(count, pages.length, paper),
    paper,
    setPaper,
    way,
    setWay,
    file,
    setFile,
    sheet,
    setSheet,
    printing,
    setPrinting,
    toast,
    showToast,
    scanned,
    add,
    setQty: (key: string, qty: number) => setItems((list) => setLabelQty(list, key, qty)),
    remove: (key: string) => {
      setItems((list) => removeLabel(list, key));
      setSheet(null);
    },
    /** เพิ่มสินค้ารหัสนี้: the code is filled in on เพิ่มสินค้า. */
    addProduct: (code: string) => {
      setSheet(null);
      router.push(`/products/new?code=${encodeURIComponent(code)}` as never);
    },
  };
}

export type Barcodes = ReturnType<typeof useBarcodes>;
