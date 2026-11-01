import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createBody,
  duplicateProblem,
  emptyForm,
  formOf,
  formProblems,
  patchBody,
  type CouponForm,
} from "@/lib/couponPage";
import { createCoupon, fetchCoupons, updateCoupon } from "@/lib/couponsApi";
import { API_BASE } from "@/lib/config";
import { fetchAttributes, fetchCarBrands, fetchProductRows } from "@/lib/productsApi";
import { useAuth } from "../AppProviders";
import type { RuleLists } from "./RuleSheets";

const TOAST_MS = 3000;
const BASE = "/settings/coupons";

/** The sheet open over the form: ช่วงเวลา, สมัครช่วง, ใช้กับ or ใครใช้ได้. */
export type CouponSheet = "when" | "signup" | "scope" | "who" | null;

/**
 * One form for เพิ่มคูปอง and แก้คูปอง (canvas v252, v260). Boxes fill in any order; บันทึก names only
 * the ones still empty, under each, and a box stops saying so once it is filled. A code another
 * coupon has is said under โค้ด. ใช้กับ's lists load beside the form; it works without them.
 */
export function useCouponForm(id: string | null) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [form, setForm] = useState<CouponForm | null>(id ? null : emptyForm());
  const [problem, setProblem] = useState<"gone" | "failed" | null>(null);
  const [tried, setTried] = useState(false);
  const [taken, setTaken] = useState<Phrase | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<CouponSheet>(null);
  const [lists, setLists] = useState<RuleLists | null>(null);
  const [listsFailed, setListsFailed] = useState(false);
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
      const c = (await fetchCoupons(fetch, API_BASE, token)).find((x) => x.id === id);
      if (!c) return setProblem("gone");
      setForm(formOf(c));
      setProblem(null);
    } catch {
      setProblem("failed");
    }
  }, [token, id]);

  const loadLists = useCallback(async () => {
    if (!token) return;
    try {
      const [attrs, cars, products] = await Promise.all([
        fetchAttributes(fetch, API_BASE, token),
        fetchCarBrands(fetch, API_BASE, token),
        fetchProductRows(fetch, API_BASE, token),
      ]);
      setLists({ brands: attrs.brands, types: attrs.types, cars, products });
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

  const set = (patch: Partial<CouponForm>) => {
    if (patch.code !== undefined) setTaken(null);
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace((id ? `${BASE}/${encodeURIComponent(id)}` : BASE) as never);

  const errors = form && tried ? formProblems(form, !id) : {};

  const save = async () => {
    if (!form || busy) return;
    setTried(true);
    if (Object.keys(formProblems(form, !id)).length > 0) return;
    setBusy(true);
    try {
      if (id) {
        await updateCoupon(fetch, API_BASE, token, id, patchBody(form));
      } else {
        const out = await createCoupon(fetch, API_BASE, token, createBody(form));
        if ("taken" in out) return setTaken(duplicateProblem(form.code));
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

  return {
    isNew: !id,
    form,
    problem,
    errors,
    taken,
    sheet,
    setSheet,
    lists,
    listsFailed,
    reloadLists: loadLists,
    toast,
    set,
    save,
    leave,
    reload: load,
  };
}

export type CouponFormState = ReturnType<typeof useCouponForm>;
