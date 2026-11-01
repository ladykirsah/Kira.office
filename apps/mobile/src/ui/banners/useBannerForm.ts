import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FULL_TOAST,
  createBody,
  emptyForm,
  formOf,
  patchBody,
  photoFailedToast,
  photoProblem,
  slotFull,
  slotRows,
  windowProblem,
  type Banner,
  type BannerForm,
  type BannerSlot,
} from "@/lib/bannerPage";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  updateBanner,
  uploadBannerImage,
} from "@/lib/bannersApi";
import { API_BASE } from "@/lib/config";
import type { ProductRow } from "@/lib/productList";
import { fetchAttributes, fetchCarBrands, fetchProductRows, imageProblem } from "@/lib/productsApi";
import type { Named } from "@/lib/productPickers";
import { useAuth } from "../AppProviders";
import { photoPreview, pickPhoto } from "../products/pickPhoto";
import { leaveToast } from "./parts";

const TOAST_MS = 3000;
const BASE = "/settings/banners";

export type BannerPhoto = { kind: "saved"; key: string } | { kind: "new"; blob: Blob; uri: string };

/** What ไปที่'s sheets pick from: part brands, part names (หมวด), car makes and the catalogue. */
export interface PickLists {
  brands: Named[];
  types: Named[];
  cars: string[];
  products: ProductRow[];
}

/**
 * One form for เพิ่มสไลด์ / เพิ่มแถบโปรโมชัน and แก้ (canvas v245). The picture waits on the page until
 * บันทึก and goes up after the banner is saved; if only the picture fails, the banner stays in the
 * list without one and the list says which slide to tap.
 */
export function useBannerForm(id: string | null, newSlot: BannerSlot) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [form, setForm] = useState<BannerForm | null>(id ? null : emptyForm(newSlot));
  const [photo, setPhoto] = useState<BannerPhoto | null>(null);
  const [lists, setLists] = useState<PickLists | null>(null);
  const [listsFailed, setListsFailed] = useState(false);
  const [problem, setProblem] = useState<"gone" | "failed" | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"goto" | "when" | "delete" | null>(null);
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
      const all = await fetchBanners(fetch, API_BASE, token);
      setBanners(all);
      if (id) {
        const b = all.find((x) => x.id === id);
        if (!b) return setProblem("gone");
        setForm(formOf(b));
        setPhoto(b.imageKey ? { kind: "saved", key: b.imageKey } : null);
      }
      setProblem(null);
    } catch {
      setProblem("failed");
    }
  }, [token, id]);

  /** The pick lists, read together; ไปที่ still works without them (names show as saved). */
  const loadLists = useCallback(async () => {
    if (!token) return;
    try {
      const [attrs, cars, products] = await Promise.all([
        fetchAttributes(fetch, API_BASE, token),
        fetchCarBrands(fetch, API_BASE, token),
        fetchProductRows(fetch, API_BASE, token),
      ]);
      setLists({
        brands: attrs.brands,
        types: attrs.types,
        cars: cars.map((c) => c.name),
        products,
      });
      setListsFailed(false);
    } catch {
      setListsFailed(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
    void loadLists();
  }, [load, loadLists]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const set = (patch: Partial<BannerForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  /** ถ่ายรูป / เลือกจากคลังภาพ — runs in the tap itself (the browser opens its chooser then). */
  const choosePhoto = (source: "camera" | "library") => {
    void pickPhoto(source).then((blob) => {
      if (!blob) return;
      if (imageProblem(blob)) {
        return showToast({
          th: "รูปต้องเป็น JPG PNG หรือ WebP ไม่เกิน 5MB",
          en: "The picture must be JPG, PNG or WebP, up to 5 MB",
        });
      }
      setPhoto({ kind: "new", blob, uri: photoPreview(blob) });
    });
  };

  const slot = form?.slot ?? newSlot;
  const rows = banners ? slotRows(banners, slot) : [];
  /** Where this banner sits in its slot: its place, or the end for a new one. */
  const index = id ? rows.findIndex((b) => b.id === id) : rows.length;

  const leave = () =>
    router.canGoBack() ? router.back() : router.replace(`${BASE}?slot=${slot}` as never);

  const errors =
    form && tried
      ? {
          photo: photoProblem(!id, photo != null),
          when: windowProblem(form.startsAt, form.endsAt),
        }
      : { photo: null, when: null };

  const save = async () => {
    if (!form || !banners || busy) return;
    setTried(true);
    if (photoProblem(!id, photo != null) || windowProblem(form.startsAt, form.endsAt)) return;
    // Another phone may have filled the main slides since ＋ was tapped (the list read here is fresh).
    if (!id && slotFull(slot, rows.length)) return showToast(FULL_TOAST);
    setBusy(true);
    try {
      const bannerId = id ?? (await createBanner(fetch, API_BASE, token, createBody(form, rows)));
      if (id) await updateBanner(fetch, API_BASE, token, id, patchBody(form));
      if (photo?.kind === "new") {
        try {
          await uploadBannerImage(fetch, API_BASE, token, bannerId, photo.blob);
        } catch {
          leaveToast(photoFailedToast(slot, Math.max(index, 0)));
        }
      }
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

  const remove = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await deleteBanner(fetch, API_BASE, token, id);
      setSheet(null);
      leave();
    } catch (e) {
      setSheet(null);
      const why = e instanceof Error ? e.message : "";
      showToast(
        { th: "ลบไม่สำเร็จ", en: "Not deleted" },
        { th: why || "ลองอีกครั้ง", en: why || "Try again" },
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    isNew: !id,
    form,
    banners,
    photo,
    lists,
    listsFailed,
    loadLists,
    problem,
    errors,
    index,
    sheet,
    setSheet,
    toast,
    set,
    choosePhoto,
    save,
    remove,
    leave,
  };
}

export type BannerFormState = ReturnType<typeof useBannerForm>;
