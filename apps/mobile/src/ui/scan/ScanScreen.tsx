import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { View } from "react-native";
import { API_BASE } from "@/lib/config";
import { actionLabel, type HoldWay, type ScanMode } from "@/lib/scanList";
import { useLang } from "../AppProviders";
import { useScreenChrome, type ChromeButton } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { SPACE } from "../theme";
import { CameraBox } from "./CameraBox";
import { CodeSheet } from "./CodeSheet";
import { QtyPad } from "./QtyPad";
import { AddCard, FoundCard, Hint, NoticeCard, NotFoundCard } from "./ScanCards";
import { ScanListView } from "./ScanListView";
import { useHandheldScanner } from "./useHandheldScanner";
import { useScan } from "./ScanSessionProvider";
import { isListMode } from "./useScanSession";

const KEYBOARD_ICON =
  "M5 6h14a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 19 18H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5 6zM6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9";

const MODES: { value: ScanMode; label: Phrase }[] = [
  { value: "add", label: { th: "เพิ่มใหม่", en: "Add" } },
  { value: "view", label: { th: "ดู", en: "View" } },
  { value: "hold", label: { th: "พักของ", en: "Hold" } },
  { value: "fill", label: { th: "เติมสต็อก", en: "Fill" } },
  { value: "sell", label: { th: "ขาย", en: "Sell" } },
];

const WAYS: { value: HoldWay; label: Phrase }[] = [
  { value: "takeAway", label: { th: "เอาไปพัก", en: "Put on hold" } },
  { value: "bringBack", label: { th: "นำกลับเข้าร้าน", en: "Bring back" } },
];

/** The grey line under the camera before anything is scanned, per mode. */
const HINTS: Record<ScanMode, Phrase> = {
  add: {
    th: "สแกนอะไหล่ชิ้นใหม่ รหัสจะขึ้นที่นี่ · ใช้เครื่องสแกนมือได้ตลอด",
    en: "Scan a new part and its code shows here · the handheld scanner always works",
  },
  view: {
    th: "สแกนแล้วเห็นราคาและสต็อกทันที · ใช้เครื่องสแกนมือได้ตลอด",
    en: "Scan to see price and stock at once · the handheld scanner always works",
  },
  hold: {
    th: "สแกนอะไหล่ที่จะเอาไปพักหรือนำกลับ ของที่พักไว้จะไม่ขายจนกว่าจะนำกลับ",
    en: "Scan parts to put on hold or bring back; held stock is not sold until it comes back",
  },
  fill: {
    th: "สแกนอะไหล่ที่เพิ่งมาถึง ใส่จำนวน แล้วกดรับเข้าสต็อก",
    en: "Scan the parts that arrived, set how many, then receive them",
  },
  sell: {
    th: "สแกนอะไหล่ที่จะขาย แล้วกดสร้างบิล",
    en: "Scan the parts to sell, then create the bill",
  },
};

/**
 * Scan (approved design, 2026-10-26): camera first, the five modes one tap apart, and one red
 * button that says what it will do. Add, View and Sell finish in the current back office until
 * their own pages are rebuilt here (owner's choice A).
 */
export function ScanScreen() {
  const { t } = useLang();
  const s = useScan();
  const [qtyFor, setQtyFor] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  // A row taken off the list (swipe, or a save) closes its amount pad with it.
  const editing = s.list.find((p) => p.variantId === qtyFor) ?? null;
  const sheetOpen = typing || editing !== null;

  const onCode = (code: string) => {
    if (!sheetOpen) void s.handleCode(code);
  };
  useHandheldScanner(onCode, !sheetOpen);

  const footer: ChromeButton[] =
    s.mode === "add" && s.addCode
      ? [
          { label: t({ th: "เพิ่มสินค้านี้", en: "Add this product" }), onPress: s.submit },
          {
            label: t({ th: "สแกนชิ้นอื่น", en: "Scan another" }),
            onPress: s.clearAddCode,
            kind: "grey",
          },
        ]
      : s.mode === "view" && s.found
        ? [{ label: t({ th: "เปิดหน้าสินค้า", en: "Open product page" }), onPress: s.submit }]
        : isListMode(s.mode) && s.list.length > 0
          ? [
              {
                label: s.saving
                  ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                  : t(actionLabel(s.list, s.mode, s.way)),
                onPress: s.submit,
              },
            ]
          : [];
  useScreenChrome(
    {
      label: t({ th: "พิมพ์รหัสเอง", en: "Type a code" }),
      icon: KEYBOARD_ICON,
      onPress: () => setTyping(true),
    },
    footer,
  );

  const showHint =
    (s.mode === "add" && !s.addCode) ||
    s.mode === "view" ||
    (isListMode(s.mode) && s.list.length === 0);

  return (
    <View>
      <Segmented
        label={t({ th: "โหมดสแกน", en: "Scan mode" })}
        options={MODES.map((m) => ({ value: m.value, label: t(m.label) }))}
        value={s.mode}
        onChange={s.setMode}
      />
      <CameraBox
        height={s.mode === "view" ? 300 : 160}
        showHint={s.mode === "view"}
        onCode={onCode}
      />
      {s.mode === "hold" && (
        <View style={{ marginTop: SPACE.m }}>
          <Segmented
            label={t({ th: "ย้ายทางไหน", en: "Which way" })}
            options={WAYS.map((w) => ({ value: w.value, label: t(w.label) }))}
            value={s.way}
            onChange={s.setWay}
          />
        </View>
      )}
      {showHint && <Hint text={t(HINTS[s.mode])} />}
      {s.notice && <NoticeCard notice={s.notice} />}
      {s.notFound && (
        <NotFoundCard code={s.notFound} onAdd={() => s.notFound && s.addFromNotFound(s.notFound)} />
      )}
      {s.mode === "add" && s.addCode && (
        <>
          <AddCard code={s.addCode} />
          <Hint
            text={t({
              th: "รหัสที่สแกนจะเป็นทั้งรหัสสินค้าและบาร์โค้ด กดเพิ่มแล้วเปิดหน้าเพิ่มสินค้าในระบบเดิม กรอกรหัสไว้ให้แล้ว",
              en: "The scanned code becomes both the Product ID and the barcode. Add opens Add product in the current back office with it filled in.",
            })}
          />
        </>
      )}
      {s.mode === "view" && s.found && (
        <FoundCard
          part={s.found}
          imageUrl={s.found.imageKey ? `${API_BASE}/img/${s.found.imageKey}` : null}
        />
      )}
      {isListMode(s.mode) && s.list.length > 0 && (
        <ScanListView
          mode={s.mode}
          way={s.way}
          list={s.list}
          refused={s.refused}
          onQty={setQtyFor}
          onRemove={s.removeOf}
          onClear={s.clearList}
        />
      )}
      {typing && (
        <CodeSheet
          onCode={(code) => {
            setTyping(false);
            void s.handleCode(code);
          }}
          onClose={() => setTyping(false)}
        />
      )}
      {editing && (
        <QtyPad
          name={editing.name}
          qty={editing.qty}
          onDone={(qty) => {
            s.setQtyOf(editing.variantId, qty);
            setQtyFor(null);
          }}
          onRemove={() => {
            s.removeOf(editing.variantId);
            setQtyFor(null);
          }}
          onClose={() => setQtyFor(null)}
        />
      )}
    </View>
  );
}
