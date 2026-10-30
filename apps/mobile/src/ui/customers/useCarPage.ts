import type { Phrase } from "@l-shopee/shared/lang";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { joinPhones, phonesOf } from "@/lib/customerPage";
import { fetchCarDetail, type CarDetail } from "@/lib/customersApi";
import { fetchCars, saveCustomer } from "@/lib/posApi";
import { useAuth } from "../AppProviders";

const TOAST_MS = 3500;

export interface CarEdit {
  name: string;
  phones: string[];
  notes: string;
}

/** One car's page: its record, open quotation and visits; แก้ไข saves name, phones and notes. */
export function useCarPage(plate: string) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [detail, setDetail] = useState<CarDetail | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [edit, setEdit] = useState<CarEdit | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (title: Phrase, detail: Phrase) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ title, detail });
    toastTimer.current = setTimeout(() => setToastState(null), TOAST_MS);
  };

  const load = useCallback(async () => {
    if (!token || !plate) return;
    const [car, cars] = await Promise.allSettled([
      fetchCarDetail(fetch, API_BASE, token, plate),
      fetchCars(fetch, API_BASE, token),
    ]);
    if (car.status === "fulfilled") setDetail(car.value);
    if (cars.status === "fulfilled") setBrands(cars.value.map((b) => b.name));
    setFailed(car.status === "rejected");
  }, [token, plate]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = () => {
    const c = detail?.customer;
    const phones = phonesOf(c?.phone ?? null);
    setEdit({
      name: c?.customerName ?? "",
      phones: phones.length > 0 ? phones : [""],
      notes: c?.notes ?? "",
    });
  };

  /** บันทึก: only what is filled goes, so a blank never wipes what is saved. */
  const save = async () => {
    if (!edit || busy || !token) return;
    setBusy(true);
    try {
      const phone = joinPhones(edit.phones);
      await saveCustomer(fetch, API_BASE, token, {
        licensePlate: detail?.customer?.licensePlate ?? plate,
        ...(edit.name.trim() ? { customerName: edit.name.trim() } : {}),
        ...(phone ? { phone } : {}),
        ...(edit.notes.trim() ? { notes: edit.notes.trim() } : {}),
      });
      setEdit(null);
      showToast(
        { th: "บันทึกแล้ว", en: "Saved" },
        { th: "ข้อมูลใหม่ขึ้นในหน้านี้", en: "Shown on this page" },
      );
      await load();
    } catch {
      showToast({ th: "บันทึกไม่สำเร็จ", en: "Not saved" }, { th: "ลองอีกครั้ง", en: "Try again" });
    } finally {
      setBusy(false);
    }
  };

  return { detail, brands, failed, load, edit, setEdit, startEdit, save, toast };
}

export type CarPage = ReturnType<typeof useCarPage>;
