import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import {
  formFrom,
  saveBody,
  stockMoves,
  validateForm,
  type FormErrors,
  type ProductDetail,
  type ProductForm,
} from "@/lib/productEdit";
import {
  codeTakenBy,
  countStock,
  deleteProductImage,
  fetchAttributes,
  fetchCarBrands,
  fetchProductDetail,
  imageProblem,
  saveProduct,
  uploadProductImage,
  type Attributes,
  type CarBrand,
  type CodeOwner,
} from "@/lib/productsApi";
import { moveHold } from "@/lib/scanApi";
import { useAuth } from "../AppProviders";
import { photoPreview, pickPhoto } from "./pickPhoto";
import { useRights } from "./useRights";

const TOAST_MS = 3500;
const MAX_PHOTOS = 10;

/** A photo on the page: one already saved, or one picked here that goes up on บันทึก. */
export type EditPhoto =
  | { kind: "saved"; id: string; imageKey: string }
  | { kind: "new"; id: string; blob: Blob; uri: string };

export type EditSheet = "brand" | "usage" | "type" | "car" | null;

/**
 * แก้ไขสินค้า's state. Nothing is written until บันทึก — photos included — so ยกเลิก really changes
 * nothing (end card, canvas v194).
 */
export function useProductEdit(id: string) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const rights = useRights();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [cars, setCars] = useState<CarBrand[] | null>(null);
  const [photos, setPhotos] = useState<EditPhoto[]>([]);
  const [failed, setFailed] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [codeOwner, setCodeOwner] = useState<CodeOwner | null>(null);
  const [sheet, setSheet] = useState<EditSheet>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  useEffect(() => {
    if (!token || !id) return;
    let live = true;
    Promise.all([
      fetchProductDetail(fetch, API_BASE, token, id),
      fetchAttributes(fetch, API_BASE, token),
      fetchCarBrands(fetch, API_BASE, token),
    ])
      .then(([d, lists, brands]) => {
        if (!live) return;
        if (!d) return setFailed(true);
        setDetail(d);
        setForm(formFrom(d));
        setPhotos(
          [...d.images]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((i) => ({ kind: "saved", id: i.id, imageKey: i.imageKey })),
        );
        setAttrs(lists);
        setCars(brands);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [token, id]);

  const set = (next: Partial<ProductForm>) => {
    setForm((f) => (f ? { ...f, ...next } : f));
    // A field being fixed stops showing its old problem.
    setErrors((e) => {
      const left = { ...e };
      for (const key of Object.keys(next)) delete left[key as keyof FormErrors];
      return left;
    });
    if ("code" in next) setCodeOwner(null);
  };

  /** ถ่ายรูป / เลือกจากคลังภาพ — must run in the tap itself (the browser opens its chooser then). */
  const addPhoto = (source: "camera" | "library") => {
    if (photos.length >= MAX_PHOTOS) {
      showToast({ th: "ใส่รูปได้ไม่เกิน 10 รูป", en: "Up to 10 photos" });
      return;
    }
    void pickPhoto(source).then((blob) => {
      if (!blob) return;
      const problem = imageProblem(blob);
      if (problem) return showToast(problem);
      nextId.current += 1;
      setPhotos((all) => [
        ...all,
        { kind: "new", id: `new-${nextId.current}`, blob, uri: photoPreview(blob) },
      ]);
    });
  };

  const removePhoto = (photoId: string) => setPhotos((all) => all.filter((p) => p.id !== photoId));

  /** Photos: the removed ones go, the new ones go up in the order they were picked. */
  const savePhotos = async (productId: string) => {
    const kept = new Set(photos.filter((p) => p.kind === "saved").map((p) => p.id));
    for (const old of detail!.images) {
      if (!kept.has(old.id)) await deleteProductImage(fetch, API_BASE, token, productId, old.id);
    }
    for (const p of photos) {
      if (p.kind === "new") await uploadProductImage(fetch, API_BASE, token, productId, p.blob);
    }
  };

  const save = async () => {
    if (!detail || !form || busy) return;
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showToast(
        { th: "ยังบันทึกไม่ได้", en: "Not saved yet" },
        { th: "แก้ช่องที่มีเส้นแดงก่อน", en: "Fix the fields marked in red" },
      );
      return;
    }
    setBusy(true);
    try {
      if (form.code.trim() !== detail.product.productRef) {
        const owner = await codeTakenBy(fetch, API_BASE, token, form.code, detail.product.id);
        if (owner) {
          setCodeOwner(owner);
          return;
        }
      }
      await saveProduct(fetch, API_BASE, token, saveBody(detail, form, rights));
      const moves = stockMoves(detail, form);
      if (moves.adjust) await countStock(fetch, API_BASE, token, moves.adjust);
      if (moves.hold) await moveHold(fetch, API_BASE, token, [moves.hold]);
      await savePhotos(detail.product.id);
      leave();
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

  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(`/products/${encodeURIComponent(id)}` as never);

  return {
    token,
    rights,
    detail,
    form,
    set,
    attrs,
    setAttrs,
    cars,
    setCars,
    photos,
    addPhoto,
    removePhoto,
    failed,
    errors,
    codeOwner,
    sheet,
    setSheet,
    busy,
    save,
    leave,
    toast,
    showToast,
  };
}

export type ProductEdit = ReturnType<typeof useProductEdit>;
