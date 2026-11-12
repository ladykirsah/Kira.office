import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { addChoice, removeChoice, updateChoice, uploadChoicePhoto } from "@/lib/choicesApi";
import { API_BASE } from "@/lib/config";
import {
  choiceBody,
  choiceFormFrom,
  choiceMoves,
  refusalText,
  validateChoiceForm,
  type Choice,
  type ChoiceErrors,
  type ChoiceForm,
} from "@/lib/productChoices";
import type { ProductDetail } from "@/lib/productEdit";
import { countStock, fetchProductDetail, imageProblem } from "@/lib/productsApi";
import { moveHold } from "@/lib/scanApi";
import { useAuth } from "../AppProviders";
import { photoPreview, pickPhoto } from "./pickPhoto";
import { useRights } from "./useRights";

const TOAST_MS = 3500;

/**
 * แก้ไขตัวเลือก / a new choice (board ChoicesGroup row 1, "แตะ แก้ไข → ฟอร์มของขนาด · รูปเดียว"). Nothing
 * is written until บันทึก — the photo included — so ยกเลิก changes nothing. `variantId` null = new.
 */
export function useChoiceForm(productId: string, variantId: string | null) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const rights = useRights();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [form, setForm] = useState<ChoiceForm | null>(null);
  const [failed, setFailed] = useState(false);
  const [errors, setErrors] = useState<ChoiceErrors>({});
  const [photo, setPhoto] = useState<{ blob: Blob; uri: string } | null>(null);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  useEffect(() => {
    if (!token || !productId) return;
    let live = true;
    fetchProductDetail(fetch, API_BASE, token, productId)
      .then((d) => {
        if (!live) return;
        if (!d) return setFailed(true);
        const found = variantId ? (d.choices ?? []).find((c) => c.variantId === variantId) : null;
        if (variantId && !found) return setFailed(true);
        setDetail(d);
        setChoice(found ?? null);
        setForm(choiceFormFrom(found ?? null));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [token, productId, variantId]);

  const set = (next: Partial<ChoiceForm>) => {
    setForm((f) => (f ? { ...f, ...next } : f));
    setErrors((e) => {
      const left = { ...e };
      for (const key of Object.keys(next)) delete left[key as keyof ChoiceErrors];
      return left;
    });
  };

  /** ถ่ายรูป / เลือกจากคลังภาพ must run in the tap itself (the browser opens its chooser then). */
  const pick = (source: "camera" | "library") => {
    void pickPhoto(source).then((blob) => {
      if (!blob) return;
      const problem = imageProblem(blob);
      if (problem) return showToast(problem);
      setPhoto({ blob, uri: photoPreview(blob) });
    });
  };

  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(`/products/${encodeURIComponent(productId)}` as never);

  const save = async () => {
    if (!form || !detail || busy.current) return;
    const found = validateChoiceForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    busy.current = true;
    try {
      const body = choiceBody(form, choice?.pricing ?? null, rights.prices);
      let id = choice?.variantId ?? "";
      if (choice) {
        const out = await updateChoice(fetch, API_BASE, token, productId, choice.variantId, body);
        if (!out.ok) return refused(out.reason);
      } else {
        const out = await addChoice(fetch, API_BASE, token, productId, body);
        if (!out.ok) return refused(out.reason);
        id = out.variantId;
      }
      const moves = choiceMoves(choice, id, form);
      if (moves.adjust) await countStock(fetch, API_BASE, token, moves.adjust);
      if (moves.hold) await moveHold(fetch, API_BASE, token, [moves.hold]);
      if (photo) await uploadChoicePhoto(fetch, API_BASE, token, productId, id, photo.blob);
      leave();
    } catch (e) {
      const why = e instanceof Error ? e.message : "";
      showToast(
        { th: "บันทึกไม่สำเร็จ", en: "Not saved" },
        { th: why || "ลองอีกครั้ง", en: why || "Try again" },
      );
    } finally {
      busy.current = false;
    }
  };

  /** A taken name or code goes under its own box; anything else is a toast. */
  const refused = (reason: string) => {
    if (reason === "value_taken") return setErrors((e) => ({ ...e, value: refusalText(reason) }));
    if (reason === "code_taken") return setErrors((e) => ({ ...e, code: refusalText(reason) }));
    showToast(refusalText(reason));
  };

  /** เอาตัวเลือกนี้ออก: back to the product page, where the row is gone. */
  const remove = async () => {
    if (!choice || busy.current) return;
    busy.current = true;
    try {
      const out = await removeChoice(fetch, API_BASE, token, productId, choice.variantId);
      if (!out.ok) return showToast(refusalText(out.reason));
      router.dismissTo(`/products/${encodeURIComponent(productId)}` as never);
    } catch {
      showToast({ th: "ลบไม่สำเร็จ", en: "Not removed" });
    } finally {
      busy.current = false;
    }
  };

  return {
    token,
    rights,
    detail,
    choice,
    form,
    set,
    errors,
    photo,
    pick,
    failed,
    save,
    remove,
    leave,
    toast,
  };
}

export type ChoiceFormState = ReturnType<typeof useChoiceForm>;
