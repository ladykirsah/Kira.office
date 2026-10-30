import type { Phrase } from "@l-shopee/shared/lang";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { clearPayments, fetchPayments, takePayment, verifySlip } from "@/lib/paymentApi";
import {
  amountSatang,
  keypadPress,
  paymentTrouble as reason,
  type PaymentRow,
} from "@/lib/paymentPage";
import { readShopAccounts, type ReceiveAccount } from "@/lib/posApi";
import { payQr } from "@/lib/qr";
import { useAuth } from "../AppProviders";

/** Which pop-up is open: amount → (account) → QR → รับเงินแล้ว, ล้าง, or ตรวจสลิป for one row. */
export type PaySheet = null | "amount" | "account" | "qr" | "done" | "clear" | { slip: PaymentRow };

const TOAST_MS = 3500;

/** What การชำระเงิน remembers and does (owner approved the drawing, canvas v137, 30 Oct 2026). */
export function usePaymentPage() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const isOwner = auth.status === "signed-in" && auth.staff.role === "super_admin";
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [slipCheckOn, setSlipCheckOn] = useState(false);
  /** Null until the shop's accounts have loaded; [] = none set up yet. */
  const [accounts, setAccounts] = useState<ReceiveAccount[] | null>(null);
  const [shopName, setShopName] = useState("");
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<PaySheet>(null);
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [taken, setTaken] = useState<PaymentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ title, detail });
    toastTimer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);

  const reload = useCallback(async () => {
    if (!token) return;
    const [list, shop] = await Promise.allSettled([
      fetchPayments(fetch, API_BASE, token),
      readShopAccounts(fetch, API_BASE, token),
    ]);
    if (list.status === "fulfilled") {
      setRows(list.value.payments);
      setSlipCheckOn(list.value.slipCheckOn);
    }
    if (shop.status === "fulfilled") {
      setAccounts(shop.value.accounts);
      setShopName(shop.value.name);
    }
    setFailed(list.status === "rejected" || shop.status === "rejected");
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const account =
    accounts?.find((a) => a.id === accountId) ??
    accounts?.find((a) => a.isDefault) ??
    accounts?.[0] ??
    null;
  const satang = amountSatang(typed);

  function startTake() {
    setTyped("");
    setTried(false);
    setTaken(null);
    setSheet("amount");
  }

  function press(key: string) {
    setTyped((v) => keypadPress(v, key));
  }

  /** สร้าง QR: needs an amount (said at the box when missing) and a PromptPay ID the QR can carry. */
  function makeQr() {
    if (satang <= 0) {
      setTried(true);
      return;
    }
    if (!account || !payQr(account.promptpayId, satang)) {
      showToast(
        { th: "สร้าง QR ไม่ได้", en: "No QR" },
        {
          th: "พร้อมเพย์ไอดีของบัญชีนี้ไม่ถูกต้อง แก้ได้ที่หน้าข้อมูลร้าน",
          en: "Fix this account's PromptPay ID on Shop info",
        },
      );
      return;
    }
    setSheet("qr");
  }

  /** ลูกค้าโอนแล้ว · บันทึก: on the list first, then รับเงินแล้ว. A failure keeps the QR up. */
  async function markPaid() {
    if (!account || busy) return;
    setBusy(true);
    try {
      const row = await takePayment(fetch, API_BASE, token, {
        methodLabel: account.label,
        promptpayId: account.promptpayId,
        amountSatang: satang,
      });
      setTaken(row);
      setRows((prev) => [row, ...prev]);
      setSheet("done");
    } catch (err) {
      showToast({ th: "ยังไม่ได้บันทึก", en: "Not saved yet" }, reason(err));
    } finally {
      setBusy(false);
    }
  }

  /** ล้าง: the owner has checked the bank; the list starts over, the records stay. */
  async function clearAll() {
    if (busy) return;
    setBusy(true);
    try {
      const n = await clearPayments(fetch, API_BASE, token);
      setRows([]);
      setSheet(null);
      showToast(
        { th: `ล้างแล้ว ${n} รายการ`, en: `Cleared ${n}` },
        { th: "บันทึกยังเก็บไว้ทั้งหมด", en: "Every record is kept" },
      );
    } catch (err) {
      showToast({ th: "ยังไม่ได้ล้าง", en: "Not cleared" }, reason(err));
    } finally {
      setBusy(false);
    }
  }

  /** ตรวจสลิป: the slip's QR from the camera, checked with the bank for this one row. */
  async function checkSlip(row: PaymentRow, qrData: string) {
    if (busy) return;
    setBusy(true);
    try {
      const ref = await verifySlip(fetch, API_BASE, token, row.id, qrData);
      setSheet(null);
      showToast(
        { th: "ตรวจสลิปแล้ว", en: "Slip checked" },
        { th: `อ้างอิง ${ref}`, en: `Ref ${ref}` },
      );
      await reload();
    } catch (err) {
      setSheet(null);
      showToast({ th: "สลิปนี้ใช้ไม่ได้", en: "This slip did not pass" }, reason(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    rows,
    slipCheckOn,
    accounts,
    account,
    shopName,
    failed,
    isOwner,
    sheet,
    setSheet,
    typed,
    satang,
    tried,
    setAccountId,
    taken,
    busy,
    toast,
    reload,
    startTake,
    press,
    makeQr,
    markPaid,
    clearAll,
    checkSlip,
  };
}

export type PaymentPage = ReturnType<typeof usePaymentPage>;
