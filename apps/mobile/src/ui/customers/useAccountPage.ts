import type { Phrase } from "@l-shopee/shared/lang";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { eraseAccount, fetchAccount, setMarketing, type AccountDetail } from "@/lib/customersApi";
import { useAuth } from "../AppProviders";

const TOAST_MS = 3500;

export type AccountSheet = null | "consent" | "erase";

/** One AirPlus account: its details, consent, orders; รับข่าวสาร and ลบข้อมูลตาม PDPA. */
export function useAccountPage(id: string) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<AccountSheet>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (title: Phrase, detail: Phrase) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ title, detail });
    toastTimer.current = setTimeout(() => setToastState(null), TOAST_MS);
  };

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setDetail(await fetchAccount(fetch, API_BASE, token, id));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (task: () => Promise<void>, done: Phrase): Promise<boolean> => {
    if (busy || !token) return false;
    setBusy(true);
    try {
      await task();
      setSheet(null);
      showToast(done, { th: "บันทึกในหน้านี้แล้ว", en: "Saved on this page" });
      await load();
      return true;
    } catch {
      showToast({ th: "ทำไม่สำเร็จ", en: "Did not work" }, { th: "ลองอีกครั้ง", en: "Try again" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** ถอนการยินยอม, or record the customer's yes when there is none yet. */
  const toggleMarketing = () => {
    const optedIn = !detail?.customer?.marketingConsentAt;
    return run(
      () => setMarketing(fetch, API_BASE, token, id, optedIn),
      optedIn
        ? { th: "บันทึกการยินยอมแล้ว", en: "Consent recorded" }
        : { th: "ถอนการยินยอมแล้ว", en: "Consent withdrawn" },
    );
  };

  const erase = () =>
    run(() => eraseAccount(fetch, API_BASE, token, id), {
      th: "ลบข้อมูลลูกค้าแล้ว",
      en: "Customer data erased",
    });

  return { detail, failed, load, sheet, setSheet, toggleMarketing, erase, toast };
}

export type AccountPage = ReturnType<typeof useAccountPage>;
