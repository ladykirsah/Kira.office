import type { Phrase } from "@l-shopee/shared/lang";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { payQr } from "@/lib/qr";
import type { PayAccount } from "@/lib/scanApi";
import { saleTotal, unitPrice, type Buyer } from "@/lib/scanSale";
import type { ScanCard } from "@/lib/scanTabs";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { BillCard } from "./BillCard";
import { QrView } from "./QrView";
import { NoticeCard } from "./ScanCards";
import type { PaySheet as Sheet, PayWay } from "./useScanSession";

const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const BUTTON_BOTTOM = 34;

const BUYERS: { value: Buyer; label: Phrase }[] = [
  { value: "customer", label: { th: "ลูกค้า", en: "Customer" } },
  { value: "mechanic", label: { th: "ช่าง", en: "Mechanic" } },
];
const BUYER_FOOT: Record<Buyer, Phrase> = {
  customer: { th: "ราคาลูกค้า · ไปจบที่หน้าทำบิล", en: "Walk-in price · finishes at ทำบิล" },
  mechanic: { th: "ราคาช่าง · เก็บเงินแล้วจบที่นี่", en: "Mechanic price · paid and done here" },
};
const WAYS: { value: PayWay; label: Phrase }[] = [
  { value: "cash", label: { th: "เงินสด", en: "Cash" } },
  { value: "promptpay", label: { th: "พร้อมเพย์ (QR)", en: "PromptPay (QR)" } },
];

interface PaySheetProps {
  sheet: Sheet;
  account: PayAccount | null;
  onBuyer: (buyer: Buyer) => void;
  onPayWay: (way: PayWay) => void;
  onGo: () => void;
  onClose: () => void;
}

/**
 * จ่ายเงิน (owner approved, 2026-10-26): pick ลูกค้า or ช่าง. ลูกค้า goes on to ทำบิล; ช่าง pays here —
 * cash straight to ออกบิล, PromptPay through the QR first — and gets the bill.
 */
export function PaySheet(props: PaySheetProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const { sheet } = props;
  const cards = sheet.cards;
  const title =
    sheet.stage === "bill"
      ? t({ th: "บิล", en: "Bill" })
      : sheet.stage === "qr"
        ? t({ th: "จ่ายเงิน", en: "Pay" })
        : t({ th: `ขาย · ${cards.length} รายการ`, en: `Sale · ${cards.length} items` });
  const goLabel = sheet.busy
    ? t({ th: "กำลังบันทึก…", en: "Saving…" })
    : sheet.stage === "list" && sheet.buyer === "mechanic" && sheet.pay === "promptpay"
      ? t({ th: "จ่ายเงิน", en: "Pay" })
      : t({ th: "ออกบิล", en: "Issue bill" });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={[styles.fill, { backgroundColor: theme.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { top: insets.top + 96, backgroundColor: theme.bg }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.textFaint }]} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={props.onClose}
              accessibilityRole="button"
              style={[styles.close, { backgroundColor: theme.surface }]}
            >
              <Text style={[styles.closeText, { color: theme.text }]}>
                {t({ th: "ปิด", en: "Close" })}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingBottom: BUTTON_BOTTOM + 50 + SPACE.xl + insets.bottom }}
          >
            {sheet.stage === "list" && <ListStage {...props} />}
            {sheet.stage === "qr" && <QrStage cards={cards} account={props.account} />}
            {sheet.stage === "bill" && sheet.bill && <BillCard bill={sheet.bill} />}
            {sheet.warning && <NoticeCard notice={{ tone: "problem", text: sheet.warning }} />}
            {sheet.problem && <NoticeCard notice={{ tone: "problem", text: sheet.problem }} />}
          </ScrollView>
          {sheet.stage !== "bill" && (
            <View style={[styles.go, { bottom: BUTTON_BOTTOM + insets.bottom }]}>
              <BigButton label={goLabel} onPress={props.onGo} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ListStage(props: PaySheetProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { sheet } = props;
  const cards = sheet.cards;
  const buyer = sheet.buyer;
  return (
    <>
      <Text style={[styles.cap, styles.firstCap, { color: theme.textMuted }]}>
        {t({ th: "ขายให้ใคร", en: "Selling to" })}
      </Text>
      <Segmented
        label={t({ th: "ขายให้ใคร", en: "Selling to" })}
        options={BUYERS.map((b) => ({ value: b.value, label: t(b.label) }))}
        value={buyer}
        onChange={props.onBuyer}
      />
      <Text style={[styles.foot, { color: theme.textMuted }]}>{t(BUYER_FOOT[buyer])}</Text>
      <View style={[styles.group, { backgroundColor: theme.surface }]}>
        {cards.map((c, i) => {
          const each = unitPrice(c.part, buyer);
          return (
            <View key={c.part.variantId} style={styles.row}>
              {c.part.photoKeys[0] ? (
                <Image
                  source={{ uri: `${API_BASE}/img/${c.part.photoKeys[0]}` }}
                  style={[styles.thumb, { backgroundColor: theme.bg }]}
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: theme.hover }]} />
              )}
              <View
                style={[
                  styles.rowInner,
                  i < cards.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.body, { color: theme.text }]} numberOfLines={1}>
                    {c.part.name}
                  </Text>
                  <Text style={[styles.sub, { color: theme.textMuted }]}>
                    {formatBaht(each)} × {c.value}
                  </Text>
                </View>
                <Text style={[styles.body, styles.num, { color: theme.text }]}>
                  {formatBaht(each * c.value)}
                </Text>
              </View>
            </View>
          );
        })}
        <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.headline, styles.grow, { color: theme.text }]}>
            {t({ th: "รวม", en: "Total" })}
          </Text>
          <Text style={[styles.headline, styles.num, { color: theme.text }]}>
            {formatBaht(saleTotal(cards, buyer))}
          </Text>
        </View>
      </View>
      {buyer === "mechanic" ? (
        <>
          <Text style={[styles.cap, { color: theme.textMuted }]}>
            {t({ th: "ชำระด้วย", en: "Paying by" })}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t({ th: "ชำระด้วย", en: "Paying by" })}
            style={[styles.group, styles.groupAfterCap, { backgroundColor: theme.surface }]}
          >
            {WAYS.map((w, i) => {
              const on = sheet.pay === w.value;
              return (
                <Pressable
                  key={w.value}
                  onPress={() => props.onPayWay(w.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[
                    styles.payRow,
                    i < WAYS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.body, styles.grow, { color: theme.text }]}>
                    {t(w.label)}
                  </Text>
                  {on && <LineIcon d={CHECK} color={theme.primary} size={18} strokeWidth={2.8} />}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={[styles.foot, styles.footAfter, { color: theme.textMuted }]}>
          {t({
            th: "ไปหน้าทำบิล กรอกข้อมูลลูกค้าและเก็บเงินที่นั่น · สต็อกลดเมื่อเก็บเงินแล้ว",
            en: "Opens ทำบิล to fill in the customer and take payment · stock comes off once paid",
          })}
        </Text>
      )}
    </>
  );
}

function QrStage({ cards, account }: { cards: readonly ScanCard[]; account: PayAccount | null }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const total = saleTotal(cards, "mechanic");
  const grid = account ? payQr(account.promptpayId, total) : null;
  return (
    <View style={[styles.qrPanel, { backgroundColor: theme.surface }]}>
      <Text style={[styles.sub, { color: theme.textMuted }]}>
        {t({ th: "พร้อมเพย์", en: "PromptPay" })} · {account?.label ?? "—"}
      </Text>
      <Text style={[styles.amount, { color: theme.text }]}>{formatBaht(total)}</Text>
      {grid ? (
        <View style={styles.qr}>
          <QrView
            grid={grid}
            size={220}
            label={t({
              th: `QR พร้อมเพย์ ${formatBaht(total)}`,
              en: `PromptPay QR ${formatBaht(total)}`,
            })}
          />
        </View>
      ) : null}
      {grid && account ? (
        <View style={styles.owner}>
          <Text style={[TYPE.body, { color: theme.text }]}>
            {account.accountName
              ? t({
                  th: `ชื่อบัญชี ${account.accountName}`,
                  en: `Account name ${account.accountName}`,
                })
              : t({
                  th: "ยังไม่ได้ใส่ชื่อบัญชี · ใส่ได้ที่หน้าข้อมูลร้าน",
                  en: "No account name yet · add it on the Shop info page",
                })}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({
              th: `พร้อมเพย์ ${account.promptpayId}`,
              en: `PromptPay ${account.promptpayId}`,
            })}
          </Text>
        </View>
      ) : null}
      {!grid && (
        <Text style={[styles.sub, styles.qrMissing, { color: theme.textMuted }]}>
          {t({
            th: "พร้อมเพย์ไอดีของบัญชีนี้ไม่ถูกต้อง แก้ได้ที่หน้าข้อมูลร้าน",
            en: "This account's PromptPay ID is not valid. Fix it on the Shop page.",
          })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingTop: 14,
    paddingHorizontal: SPACE.l,
  },
  handle: { alignSelf: "center", width: 36, height: 5, borderRadius: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  title: { ...TYPE.title2, flex: 1 },
  close: {
    height: 36,
    paddingHorizontal: SPACE.l,
    borderRadius: 18,
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  },
  closeText: { ...TYPE.subhead },
  cap: {
    ...TYPE.footnote,
    fontWeight: "600",
    marginTop: SPACE.l,
    marginBottom: 6,
    marginHorizontal: 2,
  },
  firstCap: { marginTop: 14 },
  foot: { ...TYPE.footnote, marginTop: SPACE.s, marginHorizontal: 2 },
  footAfter: { marginTop: 10 },
  group: { marginTop: SPACE.m, borderRadius: RADIUS.card, overflow: "hidden" },
  groupAfterCap: { marginTop: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.m, paddingLeft: SPACE.l },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  rowInner: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingRight: SPACE.l,
  },
  rowText: { flex: 1, minWidth: 0 },
  body: { ...TYPE.body },
  sub: { ...TYPE.subhead, fontVariant: ["tabular-nums"] },
  num: { fontVariant: ["tabular-nums"] },
  headline: { ...TYPE.headline },
  grow: { flex: 1 },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.l,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  payRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
  },
  qrPanel: {
    marginTop: SPACE.l,
    borderRadius: RADIUS.card,
    paddingTop: SPACE.xl,
    paddingBottom: 24,
    paddingHorizontal: SPACE.l,
    alignItems: "center",
    gap: SPACE.xs,
  },
  amount: { fontSize: 34, lineHeight: 44, fontWeight: "700", fontVariant: ["tabular-nums"] },
  owner: { alignItems: "center", marginTop: SPACE.s },
  qr: { marginTop: SPACE.m },
  qrMissing: { marginTop: SPACE.m, textAlign: "center" },
  go: { position: "absolute", left: SPACE.l, right: SPACE.l },
});
