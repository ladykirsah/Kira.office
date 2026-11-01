import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createItem,
  fetchAffiliate,
  fetchLinkPrice,
  updateItem,
  uploadItemImage,
} from "@/lib/affiliateApi";
import {
  createBody,
  emptyForm,
  formErrors,
  formOf,
  isLazadaLink,
  patchBody,
  pinToast,
  pinnedAfterSave,
  type AffiliateCategory,
  type AffiliateForm,
  type AffiliateItem,
  type PriceLookup,
} from "@/lib/affiliatePage";
import { API_BASE } from "@/lib/config";
import { imageProblem } from "@/lib/productsApi";
import { useAuth } from "../AppProviders";
import { photoPreview, pickPhoto } from "../products/pickPhoto";
import { leaveToast } from "./parts";

const TOAST_MS = 3000;
/** Wait this long after the link stops changing before asking Lazada (typing, not pasting). */
const LOOKUP_DELAY_MS = 600;

export type CardPhoto = { kind: "saved"; key: string } | { kind: "new"; blob: Blob; uri: string };

/**
 * One form for เพิ่มรายการ and แก้ไขรายการ (canvas v238). A Lazada link fills ราคา by itself (the
 * server reads the page); a new link asks again, and typing a price yourself always wins. The photo
 * waits on the page until บันทึก.
 */
export function useAffiliateForm(id: string | null) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [items, setItems] = useState<AffiliateItem[] | null>(null);
  const [categories, setCategories] = useState<AffiliateCategory[]>([]);
  const [form, setForm] = useState<AffiliateForm | null>(id ? null : emptyForm());
  const [photo, setPhoto] = useState<CardPhoto | null>(null);
  const [problem, setProblem] = useState<"gone" | "failed" | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<PriceLookup>("idle");
  const [sheet, setSheet] = useState<"category" | null>(null);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef(0);
  const waitLookup = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (id) {
        const item = out.items.find((i) => i.id === id);
        if (!item) return setProblem("gone");
        setForm(formOf(item));
        setPhoto(item.imageKey ? { kind: "saved", key: item.imageKey } : null);
      }
      setProblem(null);
    } catch {
      setProblem("failed");
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (waitLookup.current) clearTimeout(waitLookup.current);
    },
    [],
  );

  const set = (patch: Partial<AffiliateForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  /** Asks the server for the price on a Lazada link; only the newest answer may fill the field. */
  const lookUp = (link: string) => {
    if (waitLookup.current) clearTimeout(waitLookup.current);
    const ask = ++asked.current;
    if (!isLazadaLink(link)) return setLookup("idle");
    setLookup("looking");
    waitLookup.current = setTimeout(() => {
      void fetchLinkPrice(fetch, API_BASE, token, link.trim()).then((price) => {
        if (ask !== asked.current) return;
        if (!price) return setLookup("failed");
        set({ price });
        setLookup("found");
      });
    }, LOOKUP_DELAY_MS);
  };

  const setLink = (link: string) => {
    set({ link });
    lookUp(link);
  };

  /** Typing a price yourself ends any lookup: what you type is what is saved. */
  const setPrice = (price: string) => {
    asked.current += 1;
    if (waitLookup.current) clearTimeout(waitLookup.current);
    setLookup("idle");
    set({ price });
  };

  /** ถ่ายรูป / เลือกจากคลังภาพ — runs in the tap itself (the browser opens its chooser then). */
  const choosePhoto = (source: "camera" | "library") => {
    void pickPhoto(source).then((blob) => {
      if (!blob) return;
      if (imageProblem(blob)) {
        return showToast({
          th: "รูปต้องเป็น JPG PNG หรือ WebP ไม่เกิน 5MB",
          en: "The photo must be JPG, PNG or WebP, up to 5 MB",
        });
      }
      setPhoto({ kind: "new", blob, uri: photoPreview(blob) });
    });
  };

  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(
          (id
            ? `/settings/affiliate-items/${encodeURIComponent(id)}`
            : "/settings/affiliate-items") as never,
        );

  const save = async () => {
    if (!form || !items || busy) return;
    setTried(true);
    if (Object.keys(formErrors(form)).length > 0) return;
    setBusy(true);
    try {
      const cardId = id ?? (await createItem(fetch, API_BASE, token, createBody(form, items)));
      if (id) await updateItem(fetch, API_BASE, token, id, patchBody(form));
      let photoFailed = false;
      if (photo?.kind === "new") {
        try {
          await uploadItemImage(fetch, API_BASE, token, cardId, photo.blob);
        } catch {
          photoFailed = true;
        }
      }
      leaveToast(
        photoFailed
          ? {
              title: { th: "บันทึกแล้ว แต่รูปไม่ขึ้น", en: "Saved, but the photo did not upload" },
              detail: { th: "ลองเปลี่ยนรูปอีกครั้ง", en: "Try changing the photo again" },
            }
          : pinToast(pinnedAfterSave(items, form, id)),
      );
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

  return {
    token,
    form,
    items,
    categories,
    setCategories,
    photo,
    problem,
    load,
    errors: form && tried ? formErrors(form) : {},
    lookup,
    sheet,
    setSheet,
    toast,
    set,
    setLink,
    setPrice,
    choosePhoto,
    save,
    leave,
  };
}

export type AffiliateFormState = ReturnType<typeof useAffiliateForm>;
