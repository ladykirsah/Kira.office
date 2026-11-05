import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { formatBaht } from "@/lib/money";
import { discountOf, subtotal } from "@/lib/posBill";
import { queueSummary } from "@/lib/posQueue";
import { billDate } from "@/lib/scanSale";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { useWide } from "../desk/useWide";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { useScreenChrome, type ChromeButton } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { ItemsSection, SettingsSection, SummarySection } from "./BillCards";
import { BuyerPicker, BuyerSection } from "./BuyerCards";
import { PartPicker, ServicePicker } from "./Pickers";
import { usePos } from "./PosSessionProvider";
import { PosSheets } from "./PosSheets";

/** The drafts tray (the drawing's icon): a tray with a slot. */
export const TRAY_ICON = "M3 13l2.5-8h13L21 13v6H3zM3 13h5l1.5 2.5h5L16 13h5";
const NO_NET = "M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.3 9.1 4.5 4.5 0 0 0 7 18zM3 3l18 18";

/** The computer's two panes fill the window under the title: its height less the title and margins. */
const PANE_OFFSET = 160;
const PANE_MIN = 560;

/**
 * ทำบิล (owner approved the drawing, canvas v131, 30 Oct 2026): one page from the plate to the
 * total, pinned ชำระเงิน (a bill) or บันทึกใบเสนอราคา (a quotation). The tray holds drafts and
 * quotations; a bill made with no internet waits on this phone and shows at the top.
 */
export function PosScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const quote = pos.bill.doc === "quote";
  const { draft, plate, doc, from } = useLocalSearchParams<{
    draft?: string;
    plate?: string;
    doc?: string;
    from?: string;
  }>();
  const opened = useRef<string | null>(null);
  const wide = useWide();
  const { height } = useWindowDimensions();
  // The computer's left pane: เพิ่มสินค้า or เพิ่มบริการ, always open (DeskPos board).
  const [pick, setPick] = useState<"part" | "service">("part");

  // Scan hands a ลูกค้า sale over as ?draft=<id>: open it once, then drop it from the address.
  // ลูกค้า's ทำใบเสนอราคา / ทำบิลให้ come as ?plate=<plate>[&doc=quote], the car already filled in.
  useEffect(() => {
    const key = draft ? `draft:${draft}` : plate ? `plate:${plate}:${doc ?? ""}` : null;
    if (!key || !pos.data.ready || opened.current === key) return;
    opened.current = key;
    router.setParams({ draft: undefined, plate: undefined, doc: undefined, from: undefined });
    if (draft) void pos.openFromScan(draft, from === "customer" ? "customer" : "scan");
    else void pos.startForCar(plate!, doc === "quote" ? "quote" : "bill");
  }, [draft, plate, doc, from, pos]);

  const main: ChromeButton = quote
    ? {
        label: pos.busy
          ? t({ th: "กำลังบันทึก…", en: "Saving…" })
          : t({ th: "บันทึกใบเสนอราคา", en: "Save quotation" }),
        onPress: () => void pos.saveQuote(),
      }
    : { label: t({ th: "ชำระเงิน", en: "Payment" }), onPress: pos.startPay };
  useScreenChrome(
    {
      label: t({ th: "ฉบับร่างและใบเสนอราคา", en: "Drafts and quotations" }),
      icon: TRAY_ICON,
      badge: pos.data.drafts.length,
      onPress: () => {
        void pos.data.reloadDrafts();
        pos.setSheet("drafts");
      },
    },
    // A computer has the main button at the bill's foot instead (DeskPos board).
    wide ? [] : [main],
    {
      toast: pos.toast ? { title: t(pos.toast.title), detail: t(pos.toast.detail) } : null,
      layout: "full",
    },
  );

  if (wide) {
    return (
      <View>
        <Subtitle />
        <View style={[styles.panes, { height: Math.max(PANE_MIN, height - PANE_OFFSET) }]}>
          <View
            style={[styles.pickPane, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <ScrollView contentContainerStyle={styles.paneBody} keyboardShouldPersistTaps="handled">
              <Segmented
                label={t({ th: "เพิ่ม", en: "Add" })}
                options={[
                  { value: "part", label: t({ th: "เพิ่มสินค้า", en: "Add part" }) },
                  { value: "service", label: t({ th: "เพิ่มบริการ", en: "Add service" }) },
                ]}
                value={pick}
                onChange={setPick}
              />
              {pick === "part" ? <PartPicker desk /> : <ServicePicker />}
            </ScrollView>
          </View>
          <View
            style={[styles.billPane, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <ScrollView contentContainerStyle={styles.billBody} keyboardShouldPersistTaps="handled">
              <QueueRow />
              <View style={styles.docRow}>
                <View style={styles.docSeg}>
                  <DocPicker />
                </View>
                <View style={styles.fill} />
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                  {t({ th: "ขายให้", en: "Sell to" })}
                </Text>
                <View style={styles.buyerSeg}>
                  <BuyerPicker />
                </View>
              </View>
              <BuyerSection noPicker />
              <ItemsSection noAdd />
              {pos.bill.lines.length > 0 && (
                <>
                  <SummarySection noTotal />
                  <SettingsSection noPreview />
                </>
              )}
              {quote && <QuoteNote />}
            </ScrollView>
            <BillFoot main={main} />
          </View>
        </View>
        <PosSheets />
      </View>
    );
  }

  return (
    <View>
      <Subtitle />
      <QueueRow />
      <View style={styles.seg}>
        <DocPicker />
      </View>
      <BuyerSection />
      <ItemsSection />
      {pos.bill.lines.length > 0 && (
        <>
          <SummarySection />
          <SettingsSection />
        </>
      )}
      {quote && <QuoteNote />}
      <PosSheets />
    </View>
  );
}

/** บิลเงินสด | ใบเสนอราคา. */
function DocPicker() {
  const { t } = useLang();
  const pos = usePos();
  return (
    <Segmented
      label={t({ th: "เอกสาร", en: "Document" })}
      options={[
        { value: "bill", label: t({ th: "บิลเงินสด", en: "Cash bill" }) },
        { value: "quote", label: t({ th: "ใบเสนอราคา", en: "Quotation" }) },
      ]}
      value={pos.bill.doc}
      onChange={(v) => pos.setDoc(v as "bill" | "quote")}
    />
  );
}

function QuoteNote() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.footnote, styles.quoteNote, { color: theme.textMuted }]}>
      {t({
        th: "ใบเสนอราคาไม่ตัดสต็อก ไม่นับยอดขาย · เลขที่เดิมตลอด แม้แก้หรือส่งซ้ำ",
        en: "A quotation takes no stock and is not a sale · its number never changes",
      })}
    </Text>
  );
}

/**
 * The bill's foot on a computer (DeskPos board): the total, ดูบิล, and the phone's pinned main
 * button — ชำระเงิน, or บันทึกใบเสนอราคา on a quotation. A message shows in the total's place.
 */
function BillFoot({ main }: { main: ChromeButton }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const quote = pos.bill.doc === "quote";
  const sub = subtotal(pos.bill.lines);
  const total = sub - discountOf(sub, pos.bill.discount);
  return (
    <View style={[styles.foot, { borderTopColor: theme.border }]}>
      <View style={styles.fill}>
        {pos.toast ? (
          <Text
            style={[TYPE.subhead, { color: theme.text }]}
            accessibilityRole="alert"
            numberOfLines={2}
          >
            {t(pos.toast.title)} · {t(pos.toast.detail)}
          </Text>
        ) : (
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {quote
              ? t({ th: "รวมโดยประมาณ", en: "Estimated total" })
              : t({ th: "รวมทั้งสิ้น", en: "Total" })}
          </Text>
        )}
        <Text style={[styles.total, { color: theme.text }]}>{formatBaht(total)}</Text>
      </View>
      <View style={styles.footButton}>
        <BigButton
          label={
            quote ? t({ th: "ดูใบเสนอราคา", en: "See it" }) : t({ th: "ดูบิล", en: "See bill" })
          }
          kind="grey"
          icon={ICON.print}
          onPress={() => pos.setSheet("preview")}
        />
      </View>
      <View style={styles.footButton}>
        <BigButton label={main.label} onPress={main.onPress} />
      </View>
    </View>
  );
}

function Subtitle() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const b = pos.bill;
  const who =
    b.buyer === "customer" ? [b.plate.trim(), b.customerName.trim()] : [b.mechanicName.trim()];
  const named = who.filter(Boolean).join(" · ");
  const text =
    b.doc === "quote" && pos.quoteNumber
      ? t({ th: `ใบเสนอราคา ${pos.quoteNumber}`, en: `Quotation ${pos.quoteNumber}` })
      : named ||
        t({
          th: `บิลใหม่ · ${billDate(Date.now()).date}`,
          en: `New bill · ${billDate(Date.now()).date}`,
        });
  return <Text style={[TYPE.subhead, styles.subtitle, { color: theme.textMuted }]}>{text}</Text>;
}

/** Bills issued with no internet, still on this phone (ทำบิล 6). Tap to see each. */
function QueueRow() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const { count, refused } = queueSummary(pos.queue);
  if (count === 0) return null;
  return (
    <Pressable
      onPress={() => pos.setSheet("queue")}
      accessibilityRole="button"
      style={[
        styles.queue,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      <LineIcon d={NO_NET} color={theme.textMuted} size={22} />
      <View style={styles.queueText}>
        <Text style={[TYPE.body, { color: theme.text }]}>
          {t({ th: `รอส่งเข้าระบบ ${count} บิล`, en: `${count} bill(s) waiting to send` })}
        </Text>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {refused > 0
            ? t({
                th: `${refused} บิลส่งไม่ผ่าน · แตะเพื่อดู`,
                en: `${refused} refused · tap to see`,
              })
            : t({ th: "ส่งเองเมื่อเน็ตกลับมา", en: "They go when the internet is back" })}
        </Text>
      </View>
      <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  seg: { marginTop: SPACE.l },
  queue: {
    marginTop: SPACE.l,
    minHeight: 68,
    borderRadius: 20,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  queueText: { flex: 1, minWidth: 0 },
  quoteNote: { marginTop: SPACE.m, marginHorizontal: SPACE.xs },
  fill: { flex: 1, minWidth: 0 },
  panes: { marginTop: SPACE.l, flexDirection: "row", alignItems: "stretch", gap: SPACE.xl },
  pickPane: { width: 440, flexShrink: 0, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  billPane: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  paneBody: { paddingVertical: SPACE.l, paddingHorizontal: 18, gap: SPACE.m },
  billBody: { paddingTop: SPACE.l, paddingBottom: SPACE.xl, paddingHorizontal: SPACE.xl },
  docRow: { flexDirection: "row", alignItems: "center", gap: SPACE.m, marginBottom: SPACE.l },
  docSeg: { width: 240 },
  buyerSeg: { width: 180 },
  foot: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.s,
    borderTopWidth: 1,
  },
  total: { fontSize: 24, lineHeight: 30, fontVariant: ["tabular-nums"] },
  footButton: { minWidth: 140 },
});
