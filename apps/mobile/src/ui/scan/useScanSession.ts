import type { Phrase } from "@l-shopee/shared/lang";
import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { OLD_BACK_OFFICE, addProductPage, billPage, productPage } from "@/lib/oldBackOffice";
import { lookupPart, moveHold, parkBill, receiveStock } from "@/lib/scanApi";
import {
  addPart,
  afterBilling,
  billLines,
  holdLines,
  partProblem,
  readMode,
  removePart,
  setQty,
  type HoldWay,
  type ScanMode,
  type ScannedPart,
} from "@/lib/scanList";
import { useAuth } from "../AppProviders";
import { openPage, openPageAfterSave } from "../openPage";
import { readPref, writePref } from "../prefs";
import type { Notice } from "./ScanCards";

export type ListMode = "hold" | "fill" | "sell";
export const isListMode = (m: ScanMode): m is ListMode =>
  m === "hold" || m === "fill" || m === "sell";

const MODE_KEY = "kira_scan_mode";
const NO_LISTS: Record<ListMode, ScannedPart[]> = { hold: [], fill: [], sell: [] };
/** Why the shop's system refused a row, by part; each stock mode keeps its own. */
type Refusals = Record<string, string>;
const NO_REFUSALS: Record<ListMode, Refusals> = { hold: {}, fill: {}, sell: {} };

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

function summary(verb: Phrase, done: number, refused: number): Notice {
  if (refused === 0) {
    return {
      tone: "done",
      text: { th: `${verb.th} ${done} รายการ`, en: `${verb.en} ${done} items` },
    };
  }
  return {
    tone: "problem",
    text: {
      th: `${verb.th} ${done} รายการ · ไม่ผ่าน ${refused} รายการ ดูเหตุผลที่แถวนั้น`,
      en: `${verb.en} ${done} items · ${refused} refused — the reason is on each row`,
    },
  };
}

const blockedTab = (url: string, label: Phrase): Notice => ({
  tone: "done",
  text: { th: "แตะลิงก์ด้านล่างเพื่อเปิดหน้านั้น", en: "Tap the link below to open it" },
  action: { label, onPress: () => openPage(url) },
});

/**
 * Everything Scan remembers and does. Each stock mode keeps its own list, so switching from Sell to
 * Fill and back loses nothing and never applies one list in the other's meaning. Scans look parts up
 * side by side (a handheld scanner can be quicker than the shop's system) and keep working while a
 * save is under way; only the red button waits.
 */
export function useScanSession() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [mode, setModeState] = useState<ScanMode>("view");
  const [way, setWay] = useState<HoldWay>("takeAway");
  const [lists, setLists] = useState(NO_LISTS);
  const [refusedBy, setRefusedBy] = useState(NO_REFUSALS);
  const [addCode, setAddCode] = useState<string | null>(null);
  const [found, setFound] = useState<ScannedPart | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  // What the latest scan was and which mode is showing, read when a lookup comes back: a slow answer
  // for an earlier scan, or for a mode already left, must not cover what is on screen now.
  const latestScan = useRef(0);
  const modeNow = useRef<ScanMode>("view");

  useEffect(() => {
    void readPref(MODE_KEY).then((raw) => {
      modeNow.current = readMode(raw);
      setModeState(modeNow.current);
    });
  }, []);

  const list = isListMode(mode) ? lists[mode] : [];
  const refused = isListMode(mode) ? refusedBy[mode] : {};

  const setMode = (next: ScanMode) => {
    modeNow.current = next;
    setModeState(next);
    void writePref(MODE_KEY, next);
    setNotice(null);
    setNotFound(null);
    setFound(null);
  };

  const editList = (m: ListMode, change: (l: ScannedPart[]) => ScannedPart[]) =>
    setLists((prev) => ({ ...prev, [m]: change(prev[m]) }));

  const setRefused = (m: ListMode, refusals: Refusals) =>
    setRefusedBy((prev) => ({ ...prev, [m]: refusals }));

  const forgetRefusal = (m: ListMode, variantId: string) =>
    setRefusedBy((prev) => {
      const { [variantId]: _gone, ...rest } = prev[m];
      return { ...prev, [m]: rest };
    });

  async function handleCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setNotice(null);
    setNotFound(null);
    if (mode === "add") {
      setAddCode(code);
      return;
    }
    const m = mode;
    const scan = ++latestScan.current;
    const stillShowing = () => modeNow.current === m && latestScan.current === scan;
    try {
      const part = await lookupPart(fetch, API_BASE, token, code);
      if (isListMode(m) && part) {
        // A part scanned into a list goes on that list even if a later scan answered first.
        editList(m, (l) => addPart(l, part, m));
        forgetRefusal(m, part.variantId);
        return;
      }
      if (!stillShowing()) return;
      setFound(part);
      if (!part) setNotFound(code);
    } catch (err) {
      if (modeNow.current === m) setNotice(failed(err));
    }
  }

  async function saveHold() {
    const results = await moveHold(fetch, API_BASE, token, holdLines(list, way));
    const moved = new Set(results.filter((r) => r.applied).map((r) => r.variantId));
    const refusals = results.filter((r) => !r.applied);
    editList("hold", (l) => l.filter((p) => !moved.has(p.variantId)));
    setRefused(
      "hold",
      Object.fromEntries(refusals.map((r) => [r.variantId, r.reason ?? "refused"])),
    );
    const verb =
      way === "takeAway"
        ? { th: "ย้ายไปพักแล้ว", en: "Put on hold" }
        : { th: "นำกลับเข้าร้านแล้ว", en: "Brought back" };
    setNotice(summary(verb, moved.size, refusals.length));
  }

  async function saveFill() {
    // One movement per part, in order; the stock ledger records each on its own.
    const outcomes: { variantId: string; ok: boolean; why: string }[] = [];
    for (const p of list) {
      try {
        const r = await receiveStock(fetch, API_BASE, token, p.variantId, p.qty);
        outcomes.push({ variantId: p.variantId, ok: r.applied, why: r.reason ?? "refused" });
      } catch (err) {
        outcomes.push({ variantId: p.variantId, ok: false, why: failed(err).text.th });
      }
    }
    const received = new Set(outcomes.filter((o) => o.ok).map((o) => o.variantId));
    const refusals = outcomes.filter((o) => !o.ok);
    editList("fill", (l) => l.filter((p) => !received.has(p.variantId)));
    setRefused("fill", Object.fromEntries(refusals.map((o) => [o.variantId, o.why])));
    setNotice(summary({ th: "รับเข้าแล้ว", en: "Received" }, received.size, refusals.length));
  }

  /** Must run inside the tap: the new tab is opened before the save, or the browser blocks it. */
  async function createBill() {
    const tab = openPageAfterSave();
    setSaving(true);
    const lines = billLines(list);
    try {
      const draftId = Crypto.randomUUID();
      await parkBill(fetch, API_BASE, token, draftId, lines);
      const url = billPage(OLD_BACK_OFFICE, draftId);
      editList("sell", (l) => afterBilling(l, lines));
      setNotice(
        tab.go(url)
          ? {
              tone: "done",
              text: {
                th: "เปิดบิลในหน้าทำบิล (ระบบเดิม) แล้ว ของอยู่ในตะกร้า",
                en: "The bill is open in ทำบิล (current back office), items in the cart",
              },
            }
          : blockedTab(url, { th: "เปิดบิลในหน้าทำบิล", en: "Open the bill in ทำบิล" }),
      );
    } catch (err) {
      tab.cancel();
      setNotice(failed(err));
    } finally {
      setSaving(false);
    }
  }

  /** The red button. Synchronous up to the first save, so Sell's new tab opens inside the tap. */
  function submit() {
    if (saving) return;
    if (mode === "add" && addCode) {
      const url = addProductPage(OLD_BACK_OFFICE, addCode);
      if (!openPage(url))
        setNotice(blockedTab(url, { th: "เปิดหน้าเพิ่มสินค้า", en: "Open Add product" }));
      return;
    }
    if (mode === "view" && found) {
      const url = productPage(OLD_BACK_OFFICE, found.productId);
      if (!openPage(url))
        setNotice(blockedTab(url, { th: "เปิดหน้าสินค้า", en: "Open the product" }));
      return;
    }
    if (!isListMode(mode) || list.length === 0) return;
    if (mode === "sell") {
      void createBill();
      return;
    }
    if (list.some((p) => partProblem(p, mode, way))) {
      setNotice({
        tone: "problem",
        text: {
          th: "บางแถวใส่จำนวนเกินที่มี แก้จำนวนก่อนแล้วกดอีกครั้ง",
          en: "Some rows ask for more than there is. Fix the amount, then tap again.",
        },
      });
      return;
    }
    setSaving(true);
    void (mode === "hold" ? saveHold() : saveFill())
      .catch((err: unknown) => setNotice(failed(err)))
      .finally(() => setSaving(false));
  }

  return {
    mode,
    setMode,
    way,
    setWay,
    list,
    refused,
    addCode,
    clearAddCode: () => setAddCode(null),
    found,
    notFound,
    notice,
    saving,
    handleCode,
    submit,
    clearList: () => {
      if (!isListMode(mode)) return;
      editList(mode, () => []);
      setRefused(mode, {});
    },
    setQtyOf: (variantId: string, qty: number) => {
      if (!isListMode(mode)) return;
      editList(mode, (l) => setQty(l, variantId, qty));
      forgetRefusal(mode, variantId);
    },
    removeOf: (variantId: string) => {
      if (!isListMode(mode)) return;
      editList(mode, (l) => removePart(l, variantId));
      forgetRefusal(mode, variantId);
    },
    addFromNotFound: (code: string) => {
      setMode("add");
      setAddCode(code);
    },
  };
}

export type ScanSession = ReturnType<typeof useScanSession>;
