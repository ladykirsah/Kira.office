import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { OLD_BACK_OFFICE, shopInfoPage } from "@/lib/oldBackOffice";
import {
  STATE_WORDS,
  maskPromptpay,
  payState,
  paymentDays,
  rowSub,
  summaryLine,
  todaySummary,
  type PaymentRow,
} from "@/lib/paymentPage";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { openPage } from "../openPage";
import { ICON } from "../orders/icons";
import { SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { PaymentSheets } from "./PaymentSheets";
import { usePaymentPage, type PaymentPage } from "./usePaymentPage";

/**
 * การชำระเงิน (owner approved the drawing, canvas v137, 30 Oct 2026): today's PromptPay total, every
 * payment by day, and one red "สร้าง QR รับเงิน". ล้าง is the owner's alone (the server says so too).
 */
export function PaymentScreen() {
  const { t } = useLang();
  const page = usePaymentPage();
  const ready = page.accounts !== null;
  const noAccount = ready && page.accounts!.length === 0;

  useScreenChrome(
    null,
    ready && !noAccount
      ? [
          {
            label: t({ th: "สร้าง QR รับเงิน", en: "Make a QR" }),
            icon: ICON.qr,
            onPress: page.startTake,
          },
        ]
      : [],
    { toast: page.toast ? { title: t(page.toast.title), detail: t(page.toast.detail) } : null },
  );

  return (
    <View>
      <Subtitle page={page} />
      {page.failed && (
        <View style={styles.retry}>
          <Text style={[TYPE.subhead, { flex: 1 }]}>
            {t({ th: "โหลดรายการไม่ได้", en: "The list did not load" })}
          </Text>
          <SmallButton
            label={t({ th: "ลองอีกครั้ง", en: "Try again" })}
            onPress={() => void page.reload()}
          />
        </View>
      )}
      {noAccount ? <NoAccount /> : ready && <PaymentList page={page} />}
      <PaymentSheets page={page} />
    </View>
  );
}

function Subtitle({ page }: { page: PaymentPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const what = t({ th: "รับเงินผ่านพร้อมเพย์", en: "PromptPay payments" });
  return (
    <Text style={[TYPE.subhead, styles.subtitle, { color: theme.textMuted }]}>
      {page.shopName ? `${page.shopName} · ${what}` : what}
    </Text>
  );
}

/** ยังไม่ตั้งบัญชี: nothing to make a QR for yet; ข้อมูลร้าน is where accounts are added. */
function NoAccount() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.hover }]}>
        <LineIcon d={ICON.qr} color={theme.text} size={26} strokeWidth={2} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {t({ th: "ยังไม่มีบัญชีพร้อมเพย์", en: "No PromptPay account yet" })}
      </Text>
      <Text style={[TYPE.subhead, styles.center, { color: theme.textMuted }]}>
        {t({
          th: "เพิ่มบัญชีที่จะรับเงินก่อน แล้วสร้าง QR ได้เลย",
          en: "Add the account to receive into, then make a QR",
        })}
      </Text>
      <Pressable
        onPress={() => openPage(shopInfoPage(OLD_BACK_OFFICE))}
        accessibilityRole="link"
        hitSlop={8}
      >
        <Text style={[TYPE.body, styles.link, { color: theme.primary }]}>
          {t({ th: "ไปที่ ข้อมูลร้าน", en: "Go to Shop info" })}
        </Text>
      </Pressable>
    </View>
  );
}

/** Today's card, then the payments by day; ล้าง sits on the first day's heading, owner only. */
function PaymentList({ page }: { page: PaymentPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const now = Date.now();
  const today = todaySummary(page.rows, now, page.slipCheckOn);
  const days = paymentDays(page.rows, now);
  return (
    <>
      <View style={[styles.today, { backgroundColor: theme.surface }]}>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t({ th: "รับผ่านพร้อมเพย์วันนี้", en: "Taken by PromptPay today" })}
        </Text>
        <Text style={[styles.big, { color: theme.text }]}>{formatBaht(today.totalSatang)}</Text>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(summaryLine(today))}</Text>
      </View>
      {days.map((day, i) => (
        <Fragment key={day.title.en}>
          <View style={styles.dayHead}>
            <Text style={[TYPE.title2, { color: theme.text }]} accessibilityRole="header">
              {t(day.title)}
            </Text>
            {i === 0 && page.isOwner && (
              <Pressable
                onPress={() => page.setSheet("clear")}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={[TYPE.body, { color: theme.primary }]}>
                  {t({ th: "ล้าง", en: "Clear" })}
                </Text>
              </Pressable>
            )}
          </View>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {day.rows.map((r, n) => (
              <PayRow key={r.id} row={r} page={page} last={n === day.rows.length - 1} />
            ))}
          </View>
        </Fragment>
      ))}
    </>
  );
}

function PayRow({ row, page, last }: { row: PaymentRow; page: PaymentPage; last: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = payState(row, page.slipCheckOn);
  const tone =
    state === "awaitingSlip" ? theme.waiting : state === "slipConfirmed" ? theme.success : null;
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
            {`${row.methodLabel} · ${maskPromptpay(row.promptpayId)}`}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(rowSub(row))}</Text>
          <View style={styles.state}>
            {tone && <View style={[styles.dot, { backgroundColor: tone }]} />}
            <Text style={[TYPE.subhead, { color: tone ?? theme.textMuted }]}>
              {t(STATE_WORDS[state])}
            </Text>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text style={[TYPE.headline, styles.money, { color: theme.text }]}>
            {formatBaht(row.amountSatang)}
          </Text>
          {state === "awaitingSlip" && (
            <SmallButton
              label={t({ th: "ตรวจสลิป", en: "Check slip" })}
              onPress={() => page.setSheet({ slip: row })}
            />
          )}
        </View>
      </View>
      {!last && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  empty: { marginTop: 72, alignItems: "center", gap: SPACE.s, paddingHorizontal: 24 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  center: { textAlign: "center" },
  link: { marginTop: SPACE.xs },
  today: {
    marginTop: SPACE.l,
    borderRadius: RADIUS.card,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
    gap: 2,
  },
  big: { ...TYPE.largeTitle, lineHeight: 41, fontVariant: ["tabular-nums"] },
  dayHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: SPACE.xxl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
  },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    minHeight: 64,
  },
  rowText: { flex: 1, minWidth: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowRight: { alignItems: "flex-end", gap: 6 },
  money: { fontVariant: ["tabular-nums"] },
});
