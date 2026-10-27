import type { Phrase } from "@l-shopee/shared/lang";
import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import {
  issueMechanicBill,
  newAttempt,
  savedEarlier,
  type Attempt,
  type BillDoc,
} from "@/lib/mechanicBill";
import { payQr } from "@/lib/qr";
import { OLD_BACK_OFFICE, addProductPage, billPage, productPage } from "@/lib/oldBackOffice";
import {
  adjustStock,
  lookupPart,
  moveHold,
  parkBill,
  readShop,
  recordPayment,
  sendSale,
  todaysSaleNumbers,
  type PayAccount,
} from "@/lib/scanApi";
import { overSold, saleLines, saleTotal, type Buyer } from "@/lib/scanSale";
import {
  addScan,
  afterSale,
  cartKey,
  changedCards,
  holdMoves,
  keepAfterSave,
  needsReason,
  readTab,
  step,
  stockMoves,
  type DownReason,
  type SaveOutcome,
  type ScanCard,
  type ScanTab,
} from "@/lib/scanTabs";
import { useAuth } from "../AppProviders";
import { openPage, openPageAfterSave } from "../openPage";
import { readPref, writePref } from "../prefs";
import type { Notice } from "./ScanCards";

const TAB_KEY = "kira_scan_tab";
const LAST_BILL_KEY = "kira_last_sale_number";
const TOAST_MS = 2600;
const NO_CARDS: Record<ScanTab, ScanCard[]> = { sell: [], away: [], stock: [] };
/** Why the shop's system refused a card, by part; each tab keeps its own. */
type Refusals = Record<string, string>;
const NO_REFUSALS: Record<ScanTab, Refusals> = { sell: {}, away: {}, stock: {} };

export type PayStage = "list" | "qr" | "bill";
export type PayWay = "cash" | "promptpay";

/**
 * The จ่ายเงิน sheet: the sale as it was when จ่ายเงิน was tapped (a part scanned meanwhile waits for
 * the next sale), who is buying, how they pay, and — once issued — the bill.
 */
export interface PaySheet {
  stage: PayStage;
  cards: ScanCard[];
  buyer: Buyer;
  pay: PayWay;
  bill: BillDoc | null;
  problem: Phrase | null;
  /** The bill is out but the PromptPay payment did not reach the payment list. */
  warning: Phrase | null;
  busy: boolean;
}

/** The shop's name and PromptPay account, read when the sheet opens. */
export type ShopInfo =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; name: string; account: PayAccount | null };

/**
 * One sale being paid for, kept while its parts and amounts stay the same — across retries, the
 * buyer or pay toggle, and closing and reopening the sheet — so it is saved, and parked, only once.
 */
interface PendingSale {
  key: string;
  cards: ScanCard[];
  attempt: Attempt;
  draftId: string;
}

export interface Toast {
  title: Phrase;
  detail: Phrase;
}

const NO_CHANGE: Toast = {
  title: { th: "ยังไม่ได้เปลี่ยนจำนวน", en: "Nothing changed yet" },
  detail: { th: "กด − หรือ + ก่อน แล้วค่อยบันทึก", en: "Tap − or + first, then save" },
};
const PICK_REASON: Toast = {
  title: { th: "ลดเพราะอะไร", en: "Why did it go down?" },
  detail: { th: "เลือก นับใหม่ หรือ ของเสีย ก่อนบันทึก", en: "Pick recount or damaged, then save" },
};

/** A failed call in plain words: the API's own sentence, or "no connection" for a dropped line. */
function failed(err: unknown): Notice {
  const offline = err instanceof TypeError;
  const why = err instanceof Error ? err.message : String(err);
  return {
    tone: "problem",
    text: offline
      ? {
          th: "เชื่อมต่อระบบร้านไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง",
          en: "Could not reach the shop's system. Check the internet and try again.",
        }
      : { th: `ทำไม่สำเร็จ: ${why}`, en: `That didn't work: ${why}` },
  };
}

const UNSURE: Notice = {
  tone: "problem",
  text: {
    th: "เชื่อมต่อระบบร้านไม่ได้ระหว่างบันทึก ไม่แน่ใจว่าบันทึกแล้วหรือยัง สแกนชิ้นนั้นอีกครั้งเพื่อดูสต็อกล่าสุด",
    en: "The connection dropped while saving, so it may or may not have saved. Scan that part again to see its stock now.",
  },
};

function savedNotice(done: number, refused: number): Notice {
  if (refused === 0) {
    return { tone: "done", text: { th: `บันทึกแล้ว ${done} รายการ`, en: `Saved ${done} items` } };
  }
  return {
    tone: "problem",
    text: {
      th: `บันทึกแล้ว ${done} รายการ · ไม่ผ่าน ${refused} รายการ ดูเหตุผลที่การ์ด`,
      en: `Saved ${done} items · ${refused} refused — the reason is on each card`,
    },
  };
}

const blockedTab = (url: string, label: Phrase): Notice => ({
  tone: "done",
  text: { th: "แตะลิงก์ด้านล่างเพื่อเปิดหน้านั้น", en: "Tap the link below to open it" },
  action: { label, onPress: () => openPage(url) },
});

/**
 * Everything Scan v2 remembers and does. Each tab keeps its own cards, so switching from ขาย to
 * จัดการสต็อก and back loses nothing and never saves one tab's numbers in the other's meaning. Scans
 * look parts up side by side (a handheld scanner can be quicker than the shop's system); only the
 * red button waits.
 */
export function useScanSession() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [tab, setTabState] = useState<ScanTab>("sell");
  const [cardsBy, setCardsBy] = useState(NO_CARDS);
  const [refusedBy, setRefusedBy] = useState(NO_REFUSALS);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reason, setReason] = useState<DownReason | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<PaySheet | null>(null);
  const [shop, setShop] = useState<ShopInfo>({ status: "loading" });
  const pending = useRef<PendingSale | null>(null);
  // The latest scan and the tab on screen, read when a lookup comes back: a slow answer for an
  // earlier scan, or for a tab already left, must not cover what is on screen now.
  const latestScan = useRef(0);
  const tabNow = useRef<ScanTab>("sell");

  useEffect(() => {
    void readPref(TAB_KEY).then((raw) => {
      tabNow.current = readTab(raw);
      setTabState(tabNow.current);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const cards = cardsBy[tab];
  const editCards = (t: ScanTab, change: (c: ScanCard[]) => ScanCard[]) =>
    setCardsBy((prev) => ({ ...prev, [t]: change(prev[t]) }));
  const setRefused = (t: ScanTab, refusals: Refusals) =>
    setRefusedBy((prev) => ({ ...prev, [t]: refusals }));
  const forgetRefusal = (t: ScanTab, variantId: string) =>
    setRefusedBy((prev) => {
      const { [variantId]: _gone, ...rest } = prev[t];
      return { ...prev, [t]: rest };
    });

  const setTab = (next: ScanTab) => {
    tabNow.current = next;
    setTabState(next);
    void writePref(TAB_KEY, next);
    setNotice(null);
    setNotFound(null);
    setToast(null);
  };

  async function handleCode(raw: string) {
    const code = raw.trim();
    if (!code || sheet) return;
    setNotice(null);
    setNotFound(null);
    const t = tab;
    const scan = ++latestScan.current;
    try {
      const part = await lookupPart(fetch, API_BASE, token, code);
      if (part) {
        // A part scanned on a tab goes on that tab even if a later scan answered first.
        editCards(t, (c) => addScan(c, part, t));
        forgetRefusal(t, part.variantId);
        return;
      }
      if (tabNow.current === t && latestScan.current === scan) setNotFound(code);
    } catch (err) {
      if (tabNow.current === t) setNotice(failed(err));
    }
  }

  /** Clears the saved cards, keeps refused and unsent ones, and says what happened. */
  function finishSave(t: ScanTab, outcomes: Record<string, SaveOutcome>, why: Refusals) {
    editCards(t, (c) => keepAfterSave(c, outcomes));
    setRefused(t, why);
    const all = Object.values(outcomes);
    if (all.includes("unsure")) {
      setNotice(UNSURE);
      return;
    }
    const done = all.filter((o) => o === "applied").length;
    setNotice(savedNotice(done, all.length - done));
  }

  async function saveAway(sent: ScanCard[]) {
    const outcomes: Record<string, SaveOutcome> = {};
    const why: Refusals = {};
    try {
      for (const r of await moveHold(fetch, API_BASE, token, holdMoves(sent))) {
        outcomes[r.variantId] = r.applied ? "applied" : "refused";
        if (!r.applied) why[r.variantId] = r.reason ?? "refused";
      }
    } catch (err) {
      // One call for the batch: a dropped connection leaves every line unsure.
      for (const c of changedCards(sent, "away")) {
        if (err instanceof TypeError) outcomes[c.part.variantId] = "unsure";
        else {
          outcomes[c.part.variantId] = "refused";
          why[c.part.variantId] = failed(err).text.th;
        }
      }
    }
    finishSave("away", outcomes, why);
  }

  async function saveStock(sent: ScanCard[], downReason: DownReason | null) {
    // One movement per part, in order; the stock ledger records each on its own.
    const outcomes: Record<string, SaveOutcome> = {};
    const why: Refusals = {};
    for (const move of stockMoves(sent, downReason)) {
      const id = move.productVariantId;
      try {
        const r = await adjustStock(fetch, API_BASE, token, move);
        outcomes[id] = r.applied ? "applied" : "refused";
        if (!r.applied) why[id] = r.reason ?? "refused";
      } catch (err) {
        if (err instanceof TypeError) outcomes[id] = "unsure";
        else {
          outcomes[id] = "refused";
          why[id] = failed(err).text.th;
        }
      }
    }
    setReason(null);
    finishSave("stock", outcomes, why);
  }

  /** บันทึก on งานนอก and จัดการสต็อก. */
  function save() {
    if (saving || tab === "sell") return;
    if (changedCards(cards, tab).length === 0) {
      setToast(NO_CHANGE);
      return;
    }
    if (tab === "stock" && needsReason(cards) && !reason) {
      setToast(PICK_REASON);
      return;
    }
    setSaving(true);
    void (tab === "away" ? saveAway(cards) : saveStock(cards, reason))
      .catch((err: unknown) => setNotice(failed(err)))
      .finally(() => setSaving(false));
  }

  /** จ่ายเงิน on ขาย: opens the sheet, unless the sale asks for more than is for sale. */
  function pay() {
    if (cardsBy.sell.length === 0) return;
    const short = overSold(cardsBy.sell);
    if (short.length > 0) {
      const first = short[0]!.part;
      setNotice({
        tone: "problem",
        text: {
          th: `${first.name} ขายได้ ${first.onHand} ชิ้น แก้จำนวนก่อนแล้วกดอีกครั้ง`,
          en: `${first.name}: only ${first.onHand} for sale. Fix the amount, then tap again.`,
        },
      });
      return;
    }
    setNotice(null);
    const sale = cardsBy.sell;
    const key = cartKey(sale);
    const earlier = pending.current;
    if (earlier && earlier.key !== key && earlier.attempt.saleNumber) {
      // An earlier try lost its answer and the sale has changed since: ask the shop's system
      // whether that bill landed before starting a new one, so nothing is sold twice.
      void todaysSaleNumbers(fetch, API_BASE, token)
        .then((issued) => {
          if (savedEarlier(earlier.attempt, issued)) {
            soldOff(earlier.cards);
            setNotice({
              tone: "problem",
              text: {
                th: `บิล ${earlier.attempt.saleNumber} บันทึกไปแล้วตอนสัญญาณหลุด ของในบิลนั้นถูกเอาออกจากรายการแล้ว ตรวจรายการแล้วกดจ่ายเงินอีกครั้ง`,
                en: `Bill ${earlier.attempt.saleNumber} did save when the connection dropped; its items are off the list. Check the list, then tap Pay again.`,
              },
            });
            return;
          }
          pending.current = null;
          openSheet(sale, key);
        })
        .catch((err: unknown) => setNotice(failed(err)));
      return;
    }
    openSheet(sale, key);
  }

  function openSheet(sale: ScanCard[], key: string) {
    if (pending.current?.key !== key) {
      pending.current = {
        key,
        cards: sale,
        attempt: newAttempt(Crypto.randomUUID()),
        draftId: Crypto.randomUUID(),
      };
    }
    setSheet({
      stage: "list",
      cards: sale,
      buyer: "customer",
      pay: "cash",
      bill: null,
      problem: null,
      warning: null,
      busy: false,
    });
    loadShop();
  }

  function loadShop() {
    setShop({ status: "loading" });
    void readShop(fetch, API_BASE, token)
      .then((info) => setShop({ status: "ready", ...info }))
      .catch(() => setShop({ status: "failed" }));
  }

  const editSheet = (change: Partial<PaySheet>) =>
    setSheet((prev) => (prev ? { ...prev, ...change } : prev));

  /** The sale is done: what it sold comes off the ขาย list, and the next sale starts fresh. */
  function soldOff(sold: ScanCard[]) {
    editCards("sell", (c) => afterSale(c, sold));
    pending.current = null;
  }

  /** ลูกค้า → ออกบิล: park the sale and open ทำบิล. Runs inside the tap, so the new tab opens. */
  function sendToBill(current: PaySheet, draftId: string) {
    const tabOpen = openPageAfterSave();
    editSheet({ busy: true, problem: null });
    const lines = saleLines(current.cards, "customer");
    void parkBill(fetch, API_BASE, token, draftId, lines)
      .then(() => {
        const url = billPage(OLD_BACK_OFFICE, draftId);
        soldOff(current.cards);
        setSheet(null);
        setNotice(
          tabOpen.go(url)
            ? {
                tone: "done",
                text: {
                  th: "เปิดบิลในหน้าทำบิลแล้ว ของอยู่ในตะกร้า รอรับเงิน",
                  en: "The bill is open in ทำบิล with the items in the cart, ready for payment",
                },
              }
            : blockedTab(url, { th: "เปิดบิลในหน้าทำบิล", en: "Open the bill in ทำบิล" }),
        );
      })
      .catch((err: unknown) => {
        tabOpen.cancel();
        editSheet({ busy: false, problem: failed(err).text });
      });
  }

  /** ช่าง → ออกบิล: save the sale, list a PromptPay payment, show the bill. */
  async function issueBill(current: PaySheet, sale: PendingSale) {
    editSheet({ busy: true, problem: null });
    const lastIssued = await readPref(LAST_BILL_KEY);
    const ready = shop.status === "ready" ? shop : null;
    const out = await issueMechanicBill(
      {
        saleNumbers: () => todaysSaleNumbers(fetch, API_BASE, token),
        sendSale: (record) => sendSale(fetch, API_BASE, token, record),
        recordPayment: (p) => recordPayment(fetch, API_BASE, token, p),
        now: () => Date.now(),
      },
      sale.attempt,
      {
        cards: current.cards,
        pay: current.pay,
        account: ready?.account ?? null,
        shopName: ready?.name || "Den Air Service",
        lastIssued,
      },
    );
    if (!out.ok) {
      if (pending.current === sale) pending.current = { ...sale, attempt: out.attempt };
      editSheet({ busy: false, problem: out.why });
      return;
    }
    void writePref(LAST_BILL_KEY, out.bill.saleNumber);
    soldOff(current.cards);
    editSheet({ busy: false, stage: "bill", bill: out.bill, warning: out.warning });
  }

  /** Why PromptPay cannot go ahead yet, or null when the QR can be shown. */
  function promptPayProblem(current: PaySheet): Phrase | null {
    if (shop.status === "loading") {
      return {
        th: "กำลังโหลดบัญชีพร้อมเพย์ รอสักครู่แล้วกดอีกครั้ง",
        en: "Loading the PromptPay account. Wait a moment and tap again.",
      };
    }
    if (shop.status === "failed") {
      loadShop();
      return {
        th: "โหลดบัญชีพร้อมเพย์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วกดอีกครั้ง",
        en: "Could not load the PromptPay account. Check the internet and tap again.",
      };
    }
    if (!shop.account) {
      return {
        th: "ยังไม่ได้ตั้งบัญชีพร้อมเพย์ของร้าน ตั้งได้ที่หน้าข้อมูลร้าน",
        en: "The shop has no PromptPay account yet. Set one on the Shop page.",
      };
    }
    if (!payQr(shop.account.promptpayId, saleTotal(current.cards, "mechanic"))) {
      return {
        th: "สร้าง QR ไม่ได้ พร้อมเพย์ไอดีของบัญชีนี้ไม่ถูกต้อง แก้ได้ที่หน้าข้อมูลร้าน",
        en: "No QR: this account's PromptPay ID is not valid. Fix it on the Shop page.",
      };
    }
    return null;
  }

  /** The sheet's one red button: ออกบิล, จ่ายเงิน, or ออกบิล again after the QR. */
  function sheetGo() {
    const sale = pending.current;
    if (!sheet || sheet.busy || !sale) return;
    if (sheet.stage === "list" && sheet.buyer === "customer") {
      sendToBill(sheet, sale.draftId);
      return;
    }
    if (sheet.pay === "promptpay") {
      const problem = promptPayProblem(sheet);
      if (problem) {
        editSheet({ problem });
        return;
      }
      if (sheet.stage === "list") {
        editSheet({ stage: "qr", problem: null });
        return;
      }
    }
    void issueBill(sheet, sale);
  }

  return {
    tab,
    setTab,
    cards,
    refused: refusedBy[tab],
    notFound,
    notice,
    reason,
    setReason,
    toast,
    saving,
    sheet,
    shop,
    handleCode,
    stepOf: (variantId: string, by: 1 | -1) => {
      // The numbers being saved stay as they were sent until the save answers.
      if (saving) return;
      editCards(tab, (c) => step(c, variantId, tab, by));
      forgetRefusal(tab, variantId);
    },
    save,
    pay,
    sheetGo,
    setBuyer: (buyer: Buyer) => {
      if (!sheet?.busy) editSheet({ buyer, problem: null });
    },
    setPayWay: (way: PayWay) => {
      if (!sheet?.busy) editSheet({ pay: way, problem: null });
    },
    /** Not while a bill is being saved: its answer must land on an open sheet. */
    closeSheet: () => {
      if (!sheet?.busy) setSheet(null);
    },
    openProduct: (productId: string) => {
      const url = productPage(OLD_BACK_OFFICE, productId);
      if (!openPage(url)) {
        setNotice(blockedTab(url, { th: "เปิดหน้าสินค้า", en: "Open the product" }));
      }
    },
    addProduct: () => {
      if (!notFound) return;
      const url = addProductPage(OLD_BACK_OFFICE, notFound);
      if (!openPage(url)) {
        setNotice(blockedTab(url, { th: "เปิดหน้าเพิ่มสินค้า", en: "Open Add product" }));
      }
    },
  };
}

export type ScanSession = ReturnType<typeof useScanSession>;
