import type { Phrase } from "@l-shopee/shared/lang";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { API_BASE } from "@/lib/config";
import {
  customerSummary,
  deleteDraft,
  fetchCustomer,
  fetchDrafts,
  partLine,
  saveCustomer,
  saveDraft,
  sendBill,
  serviceLine,
  type CustomerSummary,
  type OpenDraft,
  type ProductRow,
} from "@/lib/posApi";
import {
  billMissing,
  buildBillDraft,
  buildBillSale,
  customerUpsert,
  discountOf,
  forBuyer,
  nextDocNumber,
  subtotal,
  type BillState,
  type Discount,
  type DocKind,
  type PosLine,
} from "@/lib/posBill";
import { billFromDraft } from "@/lib/posDraft";
import {
  isNetworkError,
  parseQueue,
  queueAdd,
  queueAfterSend,
  queueRefusal,
  type QueuedBill,
} from "@/lib/posQueue";
import { recordPayment } from "@/lib/scanApi";
import { saleRefusal, saleSaved, type Buyer } from "@/lib/scanSale";
import { useAuth } from "../AppProviders";
import { readPref, writePref } from "../prefs";
import { usePosData, type PosData } from "./usePosData";

export type PosSheet =
  | "part"
  | "service"
  | "discount"
  | "drafts"
  | "car"
  | "pay"
  | "queue"
  | "note"
  | "date"
  | "style"
  | "language"
  | "customer"
  | "preview"
  | { line: string }
  | { deleteDraft: string };

/** How the printed bill looks — on paper only, the record is the same. */
export interface PrintSettings {
  style: "receipt" | "invoice";
  lang: "th" | "en";
  /** The date printed on the bill; null = the day it is issued. */
  date: number | null;
}

/** The bill or quotation just finished, for the page that shows its file. */
export interface IssuedDoc {
  kind: "bill" | "quote";
  number: string;
  at: number;
  bill: BillState;
  print: PrintSettings;
  shopName: string;
  paymentMethod: "cash" | "promptpay" | null;
  receivedBy: string;
  /** Issued with no internet: on this phone, waiting to go to the system. */
  offline: boolean;
}

export interface Lookup {
  plate: string;
  status: "idle" | "loading" | "done" | "error";
  summary: CustomerSummary | null;
}

const QUEUE_KEY = "kira_pos_queue";
const RECEIVER_KEY = "kira_pos_receiver";
const LAST_BILL_KEY = "kira_pos_last_bill";
/** How often bills waiting on this phone try the server again. */
const RETRY_MS = 60_000;

export const emptyBill = (): BillState => ({
  doc: "bill",
  buyer: "customer",
  plate: "",
  province: "",
  customerName: "",
  phones: [""],
  car: "",
  mileage: "",
  mechanicName: "",
  lines: [],
  discount: { kind: "thb", value: "" },
  note: "",
});

const newId = () => Crypto.randomUUID();

export function usePosSession() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const data: PosData = usePosData();
  const [bill, setBillState] = useState<BillState>(emptyBill);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const [print, setPrint] = useState<PrintSettings>({ style: "receipt", lang: "th", date: null });
  const [lookup, setLookup] = useState<Lookup>({ plate: "", status: "idle", summary: null });
  const [sheet, setSheet] = useState<PosSheet | null>(null);
  const [tried, setTried] = useState(false);
  const [short, setShort] = useState<Record<string, number>>({});
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "promptpay">("cash");
  const [receiver, setReceiverState] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedDoc | null>(null);
  const [queue, setQueueState] = useState<QueuedBill[]>([]);
  const [lastBill, setLastBill] = useState<string | null>(null);
  // One try of one bill keeps its id and number, so a retry is never a second sale (the server
  // keys on clientUuid). Any change to the bill starts a new try.
  const attempt = useRef<{ uuid: string; number: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: Phrase, detail: Phrase) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastState({ title, detail });
    toastTimer.current = setTimeout(() => setToastState(null), 3500);
  }, []);

  useEffect(() => {
    void readPref(QUEUE_KEY).then((raw) => setQueueState(parseQueue(raw)));
    void readPref(RECEIVER_KEY).then((v) => setReceiverState(v ?? ""));
    void readPref(LAST_BILL_KEY).then(setLastBill);
  }, []);

  const saveQueue = useCallback((next: QueuedBill[]) => {
    setQueueState(next);
    void writePref(QUEUE_KEY, JSON.stringify(next));
  }, []);

  const setBill = useCallback((change: (b: BillState) => BillState) => {
    attempt.current = null;
    setShort({});
    setBillState(change);
  }, []);

  const setReceiver = (name: string) => {
    setReceiverState(name);
    void writePref(RECEIVER_KEY, name.trim() || null);
  };

  // ── the car and its customer ────────────────────────────────────────────────────────────────
  const lookupPlate = useCallback(
    async (plate: string) => {
      const p = plate.trim();
      if (!p || !token) {
        setLookup({ plate: p, status: "idle", summary: null });
        return;
      }
      setLookup({ plate: p, status: "loading", summary: null });
      try {
        const summary = customerSummary(await fetchCustomer(fetch, API_BASE, token, p));
        setLookup({ plate: p, status: "done", summary });
        if (summary.known) {
          setBill((b) => ({
            ...b,
            province: b.province || summary.province || "",
            customerName: summary.name ?? "",
            phones: summary.phones.length > 0 ? summary.phones : [""],
            car: b.car || summary.car || "",
          }));
        }
      } catch {
        setLookup({ plate: p, status: "error", summary: null });
      }
    },
    [token, setBill],
  );

  // ── items ───────────────────────────────────────────────────────────────────────────────────
  const addPart = (p: ProductRow) => {
    const there = bill.lines.find((l) => l.variantId === p.variantId);
    if (there) {
      step(there.key, 1);
      return;
    }
    setBill((b) => ({ ...b, lines: [...b.lines, partLine(p, b.buyer, newId())] }));
  };
  const addService = (s: { name: string; priceSatang: number }) =>
    setBill((b) => ({ ...b, lines: [...b.lines, serviceLine(s, newId())] }));
  const updateLine = (line: PosLine) =>
    setBill((b) => ({ ...b, lines: b.lines.map((l) => (l.key === line.key ? line : l)) }));
  const removeLine = (key: string) =>
    setBill((b) => ({ ...b, lines: b.lines.filter((l) => l.key !== key) }));

  function step(key: string, by: number) {
    const line = bill.lines.find((l) => l.key === key);
    if (!line) return;
    const next = line.quantity + by;
    if (next < 1) return;
    if (by > 0 && line.onHand !== null && next > line.onHand) {
      showToast(
        { th: `ในร้านเหลือ ${line.onHand} ชิ้น`, en: `${line.onHand} left in the shop` },
        { th: line.name, en: line.name },
      );
      return;
    }
    updateLine({ ...line, quantity: next });
  }

  const setBuyer = (buyer: Buyer) =>
    setBill((b) => ({ ...b, buyer, lines: forBuyer(b.lines, buyer) }));
  const setDoc = (doc: DocKind) => setBill((b) => ({ ...b, doc }));
  const setDiscount = (discount: Discount) => setBill((b) => ({ ...b, discount }));

  const total = subtotal(bill.lines) - discountOf(subtotal(bill.lines), bill.discount);
  const missing = billMissing(bill);

  // ── drafts and quotations ───────────────────────────────────────────────────────────────────
  const reset = () => {
    setBill(() => emptyBill());
    setDraftId(null);
    setQuoteNumber(null);
    setPrint({ style: "receipt", lang: "th", date: null });
    setLookup({ plate: "", status: "idle", summary: null });
    setTried(false);
  };

  const quoteNumbers = () => data.drafts.map((d) => d.saleNumber);

  async function storeDraft(asDoc: DocKind): Promise<{ id: string; number: string | null } | null> {
    const id = draftId ?? newId();
    const number =
      asDoc === "quote" ? (quoteNumber ?? nextDocNumber("QT", quoteNumbers(), Date.now())) : null;
    try {
      await saveDraft(
        fetch,
        API_BASE,
        token,
        buildBillDraft({ ...bill, doc: asDoc }, { draftId: id, saleNumber: number }),
      );
      setDraftId(id);
      setQuoteNumber(number);
      void data.reloadDrafts();
      return { id, number };
    } catch (e) {
      showToast(
        { th: "บันทึกไม่ได้", en: "Not saved" },
        isNetworkError(e)
          ? {
              th: "ไม่มีเน็ต ลองอีกครั้งเมื่อเน็ตกลับมา",
              en: "No internet. Try again when it is back.",
            }
          : { th: String((e as Error).message), en: String((e as Error).message) },
      );
      return null;
    }
  }

  /** เก็บบิลนี้เป็นร่าง — park it and start a new bill. */
  async function keepDraft(): Promise<boolean> {
    if (bill.lines.length === 0) {
      showToast(
        { th: "ยังไม่มีรายการ", en: "Nothing on the bill yet" },
        { th: "เพิ่มสินค้าหรือบริการก่อน", en: "Add a part or service first" },
      );
      return false;
    }
    const saved = await storeDraft(bill.doc);
    if (!saved) return false;
    reset();
    showToast(
      { th: "เก็บเป็นร่างแล้ว", en: "Kept as a draft" },
      { th: "เปิดต่อได้จากถาด", en: "Open it again from the tray" },
    );
    return true;
  }

  /** Opening a draft never loses the bill on screen: it is kept as a draft first. */
  async function openDraft(d: OpenDraft) {
    if (bill.lines.length > 0 && draftId !== d.id) {
      const saved = await storeDraft(bill.doc);
      if (!saved) return;
    }
    const { bill: restored, quoteNumber: qt } = billFromDraft(d, data.products, newId);
    setBill(() => ({ ...restored, phones: restored.phones.length ? restored.phones : [""] }));
    setDraftId(d.id);
    setQuoteNumber(qt);
    setSheet(null);
    setTried(false);
    if (restored.plate) void lookupPlate(restored.plate);
  }

  /** Scan's ลูกค้า sale, parked as a draft: open it here, ready for the customer's details. */
  async function openFromScan(id: string, from: "scan" | "customer" = "scan") {
    const scan = from === "scan";
    try {
      const found = (await fetchDrafts(fetch, API_BASE, token)).find((d) => d.id === id);
      if (!found) {
        showToast(
          scan
            ? { th: "ไม่พบบิลจากหน้าสแกน", en: "The bill from Scan was not found" }
            : { th: "ไม่พบใบเสนอราคานี้", en: "This quotation was not found" },
          { th: "ดูในฉบับร่าง", en: "Look in drafts" },
        );
        return;
      }
      await openDraft(found);
      showToast(
        scan
          ? { th: "รับของจากหน้าสแกนแล้ว", en: "Items from Scan are in" }
          : {
              th: `เปิด ${found.saleNumber ?? "ใบเสนอราคา"} แล้ว`,
              en: `${found.saleNumber ?? "Quotation"} opened`,
            },
        { th: `${found.lines.length} รายการ`, en: `${found.lines.length} items` },
      );
      void data.reloadDrafts();
    } catch {
      showToast(
        { th: "เปิดบิลจากหน้าสแกนไม่ได้", en: "Could not open the bill from Scan" },
        { th: "บิลอยู่ในฉบับร่าง ลองอีกครั้ง", en: "It is in drafts · try again" },
      );
    }
  }

  /**
   * ลูกค้า's ทำใบเสนอราคา or ทำบิลให้: a fresh bill or quotation with this car already in. The bill on
   * screen is kept as a draft first, as opening a draft does.
   */
  async function startForCar(plate: string, doc: DocKind) {
    if (bill.lines.length > 0 && !(await storeDraft(bill.doc))) return;
    reset();
    setBill(() => ({ ...emptyBill(), plate: plate.trim(), doc }));
    void lookupPlate(plate);
  }

  async function removeDraft(id: string) {
    try {
      await deleteDraft(fetch, API_BASE, token, id);
      if (draftId === id) setDraftId(null);
      await data.reloadDrafts();
    } catch {
      showToast({ th: "ลบไม่ได้", en: "Not deleted" }, { th: "ลองอีกครั้ง", en: "Try again" });
    }
  }

  /** A file of the bill before payment is kept as a quotation (drawn note: not a sale yet). */
  async function fileAsQuote(): Promise<string | null> {
    return (await storeDraft("quote"))?.number ?? null;
  }

  async function saveQuote() {
    setTried(true);
    if (missing.length > 0) {
      showToast(
        { th: "ยังใส่ไม่ครบ", en: "Something is missing" },
        { th: "ดูช่องที่ขึ้นสีแดง", en: "See the fields marked in red" },
      );
      return;
    }
    setBusy(true);
    const saved = await storeDraft("quote");
    setBusy(false);
    if (!saved?.number) return;
    setIssued({
      kind: "quote",
      number: saved.number,
      at: Date.now(),
      bill,
      print,
      shopName: data.shopName,
      paymentMethod: null,
      receivedBy: "",
      offline: false,
    });
    router.push("/pos/done");
  }

  // ── paying and issuing the bill ─────────────────────────────────────────────────────────────
  function startPay() {
    setTried(true);
    if (missing.length > 0) {
      showToast(
        { th: "ยังใส่ไม่ครบ", en: "Something is missing" },
        { th: "ดูช่องที่ขึ้นสีแดง", en: "See the fields marked in red" },
      );
      return;
    }
    setSheet("pay");
  }

  const account =
    data.accounts.find((a) => a.id === accountId) ??
    data.accounts.find((a) => a.isDefault) ??
    data.accounts[0] ??
    null;

  async function issue() {
    if (busy) return;
    const now = Date.now();
    const known = [...data.issuedNumbers, ...queue.map((q) => q.sale.saleNumber), lastBill];
    attempt.current ??= { uuid: newId(), number: nextDocNumber("DAS", known, now) };
    const { uuid, number } = attempt.current;
    const sale = buildBillSale(bill, {
      clientUuid: uuid,
      saleNumber: number,
      paymentMethod: payMethod,
      receivedBy: receiver,
    });
    setBusy(true);
    let offline = false;
    try {
      const result = await sendBill(fetch, API_BASE, token, sale);
      if (!saleSaved(result)) {
        setBusy(false);
        setSheet(null);
        setShort(
          Object.fromEntries(result.conflicts.map((c) => [c.productVariantId, c.available])),
        );
        const why = saleRefusal(result);
        showToast({ th: "ยังออกบิลไม่ได้", en: "The bill was not issued" }, why);
        return;
      }
    } catch (e) {
      if (!isNetworkError(e)) {
        setBusy(false);
        const msg = String((e as Error).message);
        showToast({ th: "ยังออกบิลไม่ได้", en: "The bill was not issued" }, { th: msg, en: msg });
        return;
      }
      offline = true;
      saveQueue(
        queueAdd(queue, {
          sale,
          issuedAt: now,
          totalSatang: total,
          label: bill.buyer === "customer" ? bill.plate.trim() : bill.mechanicName.trim(),
          status: "waiting",
          reason: null,
          after: { customer: customerUpsert(bill), draftId },
        }),
      );
    }
    setLastBill(number);
    void writePref(LAST_BILL_KEY, number);
    if (!offline) void afterIssue(sale.saleNumber);
    setIssued({
      kind: "bill",
      number,
      at: now,
      bill,
      print,
      shopName: data.shopName,
      paymentMethod: payMethod,
      receivedBy: payMethod === "cash" ? receiver.trim() : "",
      offline,
    });
    attempt.current = null;
    setBusy(false);
    setSheet(null);
    router.push("/pos/done");
  }

  /** The rest of a saved bill: the money record, the customer's car, the parked draft. Never silent. */
  async function afterIssue(saleNumber: string) {
    const tasks: Promise<unknown>[] = [];
    if (payMethod === "promptpay" && account) {
      tasks.push(
        recordPayment(fetch, API_BASE, token, {
          methodLabel: account.label,
          promptpayId: account.promptpayId,
          amountSatang: total,
          saleNumber,
        }),
      );
    }
    const car = customerUpsert(bill);
    if (car) tasks.push(saveCustomer(fetch, API_BASE, token, car));
    if (draftId) tasks.push(deleteDraft(fetch, API_BASE, token, draftId));
    const results = await Promise.allSettled(tasks);
    if (results.some((r) => r.status === "rejected")) {
      showToast(
        { th: `ออกบิล ${saleNumber} แล้ว`, en: `Bill ${saleNumber} issued` },
        {
          th: "แต่บันทึกข้อมูลลูกค้าหรือการโอนไม่ครบ ลองแก้ในหน้าลูกค้า",
          en: "But the customer or payment record did not save",
        },
      );
    }
    void data.reload();
  }

  // ── bills waiting on this phone ─────────────────────────────────────────────────────────────
  const sending = useRef(false);
  const resend = useCallback(async () => {
    if (sending.current || !token) return;
    sending.current = true;
    let next = queue;
    for (const q of queue) {
      try {
        const result = await sendBill(fetch, API_BASE, token, q.sale);
        const saved = saleSaved(result);
        next = queueAfterSend(
          next,
          q.sale.clientUuid,
          saved ? { kind: "saved" } : { kind: "refused", reason: queueRefusal(q.sale, result) },
        );
        if (saved) void finishSent(q);
      } catch (e) {
        next = queueAfterSend(
          next,
          q.sale.clientUuid,
          isNetworkError(e)
            ? { kind: "offline" }
            : { kind: "refused", reason: String((e as Error).message) },
        );
        if (isNetworkError(e)) break;
      }
    }
    sending.current = false;
    if (next !== queue) saveQueue(next);
  }, [queue, token, saveQueue]);

  /** A waiting bill now in the system: the car's record and its draft, as a bill sent at once gets. */
  async function finishSent(q: QueuedBill) {
    const tasks: Promise<unknown>[] = [];
    if (q.after?.customer) tasks.push(saveCustomer(fetch, API_BASE, token, q.after.customer));
    if (q.after?.draftId) tasks.push(deleteDraft(fetch, API_BASE, token, q.after.draftId));
    const results = await Promise.allSettled(tasks);
    if (results.some((r) => r.status === "rejected")) {
      showToast(
        { th: `ส่ง ${q.sale.saleNumber} เข้าระบบแล้ว`, en: `${q.sale.saleNumber} sent` },
        {
          th: "แต่บันทึกข้อมูลลูกค้าไม่ครบ ลองแก้ในหน้าลูกค้า",
          en: "But the customer record did not save",
        },
      );
    }
    void data.reload();
  }

  // Back online → the waiting bills go by themselves: when the phone says so, and every minute,
  // because shop wifi can stay "connected" while the internet behind it is down.
  useEffect(() => {
    if (queue.length === 0) return;
    const go = () => void resend();
    const timer = setInterval(go, RETRY_MS);
    if (Platform.OS === "web") window.addEventListener("online", go);
    go();
    return () => {
      clearInterval(timer);
      if (Platform.OS === "web") window.removeEventListener("online", go);
    };
  }, [queue.length, resend]);

  const newBill = () => {
    reset();
    setIssued(null);
    router.replace("/pos");
  };

  return {
    data,
    bill,
    setBill,
    setBuyer,
    setDoc,
    setDiscount,
    draftId,
    quoteNumber,
    print,
    setPrint,
    lookup,
    lookupPlate,
    addPart,
    addService,
    updateLine,
    removeLine,
    step,
    total,
    missing,
    tried,
    short,
    sheet,
    setSheet,
    toast,
    showToast,
    payMethod,
    setPayMethod,
    receiver,
    setReceiver,
    account,
    setAccountId,
    busy,
    startPay,
    issue,
    saveQuote,
    keepDraft,
    fileAsQuote,
    openDraft,
    openFromScan,
    startForCar,
    removeDraft,
    issued,
    newBill,
    queue,
    resend,
  };
}

export type PosSession = ReturnType<typeof usePosSession>;
