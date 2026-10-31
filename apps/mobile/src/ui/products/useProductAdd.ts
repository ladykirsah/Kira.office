import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import {
  addBody,
  autoName,
  blankForm,
  carryFrom,
  draftKey,
  draftReady,
  openingMoves,
  type Carry,
} from "@/lib/productAdd";
import { validateForm, type FormErrors, type ProductForm } from "@/lib/productEdit";
import {
  codeTakenBy,
  countStock,
  fetchAttributes,
  fetchCarBrands,
  saveProduct,
  uploadProductImage,
  type Attributes,
  type CarBrand,
  type CodeOwner,
} from "@/lib/productsApi";
import { moveHold } from "@/lib/scanApi";
import { useAuth } from "../AppProviders";
import { usePhotoPicks, type EditSheet } from "./useProductEdit";
import { useRights } from "./useRights";

const TOAST_MS = 3500;
/** Wait this long after typing stops before checking the code / saving the draft. */
const CODE_CHECK_MS = 400;
const DRAFT_MS = 1500;
/** A draft that did not save tries again by itself after this long (บันทึกร่างไม่ได้ · ลองใหม่เอง). */
const DRAFT_RETRY_MS = 5000;

const DRAFT_FAILED: Phrase = {
  th: "บันทึกร่างไม่ได้ · ลองใหม่เอง",
  en: "Draft not saved · trying again",
};

/** The steps of one บันทึก that already went through, so trying again never adds stock twice. */
interface Done {
  stock: boolean;
  photos: Set<string>;
}

/**
 * เพิ่มสินค้า's state (canvas v196). The form saves itself as a draft in the background once it has
 * a name and a code no other product uses, so ปิด keeps the work; บันทึก makes the product, adds its
 * first stock and photos, and starts the next one with the last one's brand, system, part name and
 * cars (ยกมาจากชิ้นก่อน).
 */
export function useProductAdd(startCode: string) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const rights = useRights();
  const [form, setForm] = useState<ProductForm>(() => ({ ...blankForm(), code: startCode }));
  const [carry, setCarry] = useState<Carry | null>(null);
  const [attrs, setAttrs] = useState<Attributes | null>(null);
  const [cars, setCars] = useState<CarBrand[] | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [codeOwner, setCodeOwner] = useState<CodeOwner | null>(null);
  /** The code the last check answered for; a draft waits until it is the one typed. */
  const [checkedCode, setCheckedCode] = useState<string | null>(null);
  const [sheet, setSheet] = useState<EditSheet>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Phrase | null>(null);
  const [retry, setRetry] = useState(0);
  /** The code check could not reach the shop's system, so the draft cannot be saved either. */
  const [checkFailed, setCheckFailed] = useState(false);
  /** Goes up after each บันทึก, so the page scrolls back to the top for the next product. */
  const [round, setRound] = useState(0);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftId = useRef<string | null>(null);
  const savedKey = useRef("");
  const drafting = useRef<Promise<void> | null>(null);
  const done = useRef<Done>({ stock: false, photos: new Set() });
  const closeTried = useRef(false);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);
  const { photos, setPhotos, addPhoto, removePhoto } = usePhotoPicks(showToast);

  useEffect(() => {
    if (!token) return;
    let live = true;
    Promise.all([fetchAttributes(fetch, API_BASE, token), fetchCarBrands(fetch, API_BASE, token)])
      .then(([lists, brands]) => {
        if (!live) return;
        setAttrs(lists);
        setCars(brands);
      })
      .catch(() => live && showToast({ th: "โหลดรายการไม่ได้", en: "The lists did not load" }));
    return () => {
      live = false;
    };
  }, [token, showToast]);

  // Whose code is this? Asked as the code is typed: a first save without an id would otherwise
  // write over the product that has it.
  const code = form.code.trim();
  useEffect(() => {
    if (!token || !code) return;
    let live = true;
    const wait = setTimeout(() => {
      codeTakenBy(fetch, API_BASE, token, code, draftId.current)
        .then((owner) => {
          if (!live) return;
          setCodeOwner(owner);
          setCheckedCode(code);
          setCheckFailed(false);
        })
        .catch(() => {
          // Not known (no connection): no draft is saved until it is, so ask again shortly.
          if (!live) return;
          setCheckFailed(true);
          setTimeout(() => setRetry((n) => n + 1), DRAFT_RETRY_MS);
        });
    }, CODE_CHECK_MS);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [token, code, retry]);

  const codeUnsure = codeOwner != null || checkedCode !== code;
  const key = draftKey(form);

  const saveDraft = useCallback(async () => {
    const out = await saveProduct(
      fetch,
      API_BASE,
      token,
      addBody(form, rights, draftId.current, false),
    );
    draftId.current = out.productId;
    savedKey.current = key;
    setNote(null);
  }, [form, rights, token, key]);

  // The background draft: after typing stops, once there is enough to keep.
  useEffect(() => {
    if (busy || key === savedKey.current || !draftReady(form, codeUnsure)) return;
    const wait = setTimeout(() => {
      const run = saveDraft().catch(() => {
        setNote(DRAFT_FAILED);
        setTimeout(() => setRetry((n) => n + 1), DRAFT_RETRY_MS);
      });
      drafting.current = run;
    }, DRAFT_MS);
    return () => clearTimeout(wait);
    // `retry` re-runs a draft that failed.
  }, [form, key, codeUnsure, busy, retry, saveDraft]);

  const set = (next: Partial<ProductForm>) => {
    setForm((f) => ({ ...f, ...next }));
    setErrors((e) => {
      const left = { ...e };
      for (const k of Object.keys(next)) delete left[k as keyof FormErrors];
      return left;
    });
    if ("code" in next) {
      setCodeOwner(null);
      setCheckedCode(null);
    }
  };

  const nameIt = () => {
    const name = autoName(form, attrs, cars);
    if (name) return set({ name });
    showToast({
      th: "เลือกชื่ออะไหล่ ใส่รถ และรหัสก่อน",
      en: "Pick the part name, add a car and the code first",
    });
  };

  /** ล้าง: the next product starts empty, like the first. */
  const clearCarry = () => {
    setCarry(null);
    set({ brand: null, usage: null, type: null, fitments: [] });
  };

  const startNext = (saved: ProductForm) => {
    const next = carryFrom(saved);
    setCarry(next);
    setForm(blankForm(next));
    setPhotos([]);
    setErrors({});
    setCodeOwner(null);
    setCheckedCode(null);
    setNote(null);
    setCheckFailed(false);
    draftId.current = null;
    savedKey.current = "";
    done.current = { stock: false, photos: new Set() };
    setRound((n) => n + 1);
  };

  const save = async () => {
    if (busy) return;
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
      // A draft still on its way would otherwise look like another product with this code.
      await drafting.current?.catch(() => undefined);
      const owner = await codeTakenBy(fetch, API_BASE, token, form.code, draftId.current);
      if (owner) {
        setCodeOwner(owner);
        return;
      }
      const out = await saveProduct(
        fetch,
        API_BASE,
        token,
        addBody(form, rights, draftId.current, true),
      );
      draftId.current = out.productId;
      if (!done.current.stock) {
        const moves = openingMoves(out.variantId, form);
        if (moves.adjust) await countStock(fetch, API_BASE, token, moves.adjust);
        if (moves.hold) await moveHold(fetch, API_BASE, token, [moves.hold]);
        done.current.stock = true;
      }
      for (const p of photos) {
        if (p.kind !== "new" || done.current.photos.has(p.id)) continue;
        await uploadProductImage(fetch, API_BASE, token, out.productId, p.blob);
        done.current.photos.add(p.id);
      }
      startNext(form);
      showToast({ th: `บันทึกแล้ว · ${form.code.trim()}`, en: `Saved · ${form.code.trim()}` });
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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/products" as never));

  /** ปิด keeps the draft: a change not saved yet is saved first. If that fails, the note says so and
   *  a second ปิด leaves anyway. */
  const close = async () => {
    if (!closeTried.current && key !== savedKey.current && draftReady(form, codeUnsure)) {
      closeTried.current = true;
      try {
        await drafting.current?.catch(() => undefined);
        if (key !== savedKey.current) await saveDraft();
      } catch {
        setNote(DRAFT_FAILED);
        return;
      }
    }
    goBack();
  };

  return {
    token,
    rights,
    form,
    set,
    attrs,
    setAttrs,
    cars,
    setCars,
    photos,
    addPhoto,
    removePhoto,
    errors,
    codeOwner,
    sheet,
    setSheet,
    busy,
    save,
    close,
    nameIt,
    carry,
    clearCarry,
    // A draft that is ready but held up by a code check that could not get through says so too.
    note: note ?? (checkFailed && draftReady(form, false) ? DRAFT_FAILED : null),
    round,
    toast,
  };
}

export type ProductAdd = ReturnType<typeof useProductAdd>;
