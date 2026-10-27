import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { View } from "react-native";
import { stepLabel, stockLine, type DownReason, type ScanTab } from "@/lib/scanTabs";
import { useLang } from "../AppProviders";
import { useScreenChrome, type ChromeButton } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { CameraBox } from "./CameraBox";
import { CodeSheet } from "./CodeSheet";
import { PaySheet } from "./PaySheet";
import { ProductCard } from "./ProductCard";
import { Hint, NoticeCard, NotFoundCard } from "./ScanCards";
import { useHandheldScanner } from "./useHandheldScanner";
import { useScan } from "./ScanSessionProvider";

const KEYBOARD_ICON =
  "M5 6h14a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 19 18H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5 6zM6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9";

/** The camera is as tall as the not-found card (owner, 2026-10-26). */
const CAMERA_HEIGHT = 142;

const TABS: { value: ScanTab; label: Phrase }[] = [
  { value: "sell", label: { th: "ขาย", en: "Sell" } },
  { value: "away", label: { th: "งานนอก", en: "Outside job" } },
  { value: "stock", label: { th: "จัดการสต็อก", en: "Manage stock" } },
];

const REASONS: { value: DownReason; label: Phrase }[] = [
  { value: "recount", label: { th: "นับใหม่", en: "Recount" } },
  { value: "damaged", label: { th: "ของเสีย", en: "Damaged" } },
];

/**
 * Scan v2 (owner approved, 2026-10-26): camera, then three tabs — ขาย, งานนอก, จัดการสต็อก — then
 * one full card per scanned part, newest on top. Each tab ends in one short red button: จ่ายเงิน on
 * ขาย, บันทึก on the other two, เพิ่มสินค้า when a code is not found.
 */
export function ScanScreen() {
  const { t } = useLang();
  const s = useScan();
  const [typing, setTyping] = useState(false);

  const onCode = (code: string) => {
    if (!typing && !s.sheet) void s.handleCode(code);
  };
  useHandheldScanner(onCode, !typing && !s.sheet);

  const footer: ChromeButton[] = s.notFound
    ? [{ label: t({ th: "เพิ่มสินค้า", en: "Add product" }), onPress: s.addProduct }]
    : s.cards.length === 0
      ? []
      : s.tab === "sell"
        ? [{ label: t({ th: "จ่ายเงิน", en: "Pay" }), onPress: s.pay }]
        : [
            {
              label: s.saving
                ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                : t({ th: "บันทึก", en: "Save" }),
              onPress: s.save,
            },
          ];
  const lowered = s.tab === "stock" && !s.notFound && s.cards.some((c) => c.value < c.part.onHand);
  useScreenChrome(
    {
      label: t({ th: "พิมพ์รหัสเอง", en: "Type a code" }),
      icon: KEYBOARD_ICON,
      onPress: () => setTyping(true),
    },
    footer,
    {
      choice: lowered
        ? {
            label: t({ th: "ลดเพราะ", en: "Lower because" }),
            options: REASONS.map((r) => ({ value: r.value, label: t(r.label) })),
            value: s.reason,
            onChange: (v) => s.setReason(v as DownReason),
          }
        : null,
      toast: s.toast ? { title: t(s.toast.title), detail: t(s.toast.detail) } : null,
    },
  );

  return (
    <View>
      <CameraBox height={CAMERA_HEIGHT} showHint={false} onCode={onCode} />
      <View style={{ marginTop: 10 }}>
        <Segmented
          label={t({ th: "ทำอะไร", en: "What to do" })}
          options={TABS.map((x) => ({ value: x.value, label: t(x.label) }))}
          value={s.tab}
          onChange={s.setTab}
        />
      </View>
      {s.notice && <NoticeCard notice={s.notice} />}
      {s.notFound && <NotFoundCard code={s.notFound} />}
      {s.cards.map((c) => {
        const refusal = s.refused[c.part.variantId];
        return (
          <ProductCard
            key={c.part.variantId}
            part={c.part}
            label={t(stepLabel(s.tab))}
            sub={
              refusal
                ? t({ th: `ไม่ผ่าน: ${refusal}`, en: `Refused: ${refusal}` })
                : t(stockLine(c.part, s.tab))
            }
            value={c.value}
            onMinus={() => s.stepOf(c.part.variantId, -1)}
            onPlus={() => s.stepOf(c.part.variantId, 1)}
            onOpen={() => s.openProduct(c.part.productId)}
          />
        );
      })}
      {s.tab === "sell" && s.cards.length === 1 && (
        <Hint
          text={t({
            th: "สแกนชิ้นเดิมซ้ำ = เพิ่มอีก 1 · แตะรูปหรือชื่อเพื่อเปิดหน้าสินค้า",
            en: "Scan the same part again for one more · tap a photo or the name to open it",
          })}
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
      {s.sheet && (
        <PaySheet
          sheet={s.sheet}
          account={s.shop.status === "ready" ? s.shop.account : null}
          onBuyer={s.setBuyer}
          onPayWay={s.setPayWay}
          onGo={s.sheetGo}
          onClose={s.closeSheet}
        />
      )}
    </View>
  );
}
