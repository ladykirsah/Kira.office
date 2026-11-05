import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import {
  STATE_WORDS,
  billCell,
  countLine,
  maskPromptpay,
  payState,
  paymentDays,
  todayAccounts,
  todaySummary,
  type PaymentRow,
} from "@/lib/paymentPage";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { SmallButton } from "../orders/parts";
import { SPACE, TYPE } from "../theme";
import type { PaymentPage } from "./usePaymentPage";

/**
 * การชำระเงิน on a computer (DeskPayment board, 4 Nov 2026): today's PromptPay total beside each
 * account's share, then one card holding every payment by day as a table. No clock time in a row;
 * ล้าง (the owner's alone) on the first day's heading, as on the phone.
 */
export function PaymentTable({ page }: { page: PaymentPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const now = Date.now();
  const today = todaySummary(page.rows, now, page.slipCheckOn);
  const accounts = todayAccounts(page.rows, now);
  const days = paymentDays(page.rows, now);
  const grey = [TYPE.subhead, { color: theme.textMuted }];

  const columns: TableColumn<PaymentRow>[] = [
    {
      key: "account",
      label: t({ th: "รับเข้าบัญชี", en: "Into" }),
      cell: (r) => (
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={1}>
          {r.methodLabel}{" "}
          <Text style={{ color: theme.textMuted }}>· {maskPromptpay(r.promptpayId)}</Text>
        </Text>
      ),
    },
    {
      key: "bill",
      label: t({ th: "บิล", en: "Bill" }),
      width: 200,
      cell: (r) => (
        <Text style={grey} numberOfLines={1}>
          {billCell(r)}
        </Text>
      ),
    },
    {
      key: "state",
      label: t({ th: "สถานะ", en: "Status" }),
      width: 150,
      cell: (r) => <StateCell row={r} slipCheckOn={page.slipCheckOn} />,
    },
    {
      key: "amount",
      label: t({ th: "จำนวนเงิน", en: "Amount" }),
      width: 140,
      align: "right",
      cell: (r) => (
        <View style={styles.amount}>
          <Text style={[TYPE.body, styles.money, { color: theme.text }]}>
            {formatBaht(r.amountSatang)}
          </Text>
          {payState(r, page.slipCheckOn) === "awaitingSlip" && (
            <SmallButton
              label={t({ th: "ตรวจสลิป", en: "Check slip" })}
              onPress={() => page.setSheet({ slip: r })}
            />
          )}
        </View>
      ),
    },
  ];

  return (
    <>
      <View style={styles.today}>
        <DeskCard pad={22}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                {t({ th: "รับผ่านพร้อมเพย์วันนี้", en: "Taken by PromptPay today" })}
              </Text>
              <Text style={[styles.big, { color: theme.text }]}>
                {formatBaht(today.totalSatang)}
              </Text>
              <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(countLine(today))}</Text>
            </View>
            {accounts.map((a) => (
              <View key={a.label} style={styles.stat}>
                <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{a.label}</Text>
                <Text style={[styles.mid, { color: theme.text }]}>{formatBaht(a.satang)}</Text>
                <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{a.masked}</Text>
              </View>
            ))}
          </View>
        </DeskCard>
      </View>
      {days.length > 0 && (
        <DeskCard pad={4}>
          <Table columns={columns} rows={[]} rowKey={(r) => r.id} />
          {days.map((day, i) => (
            <Fragment key={day.title.en}>
              <View
                style={[
                  styles.dayHead,
                  i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                ]}
              >
                <Text style={[styles.dayTitle, { color: theme.text }]} accessibilityRole="header">
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
              <Table
                columns={columns}
                rows={day.rows}
                rowKey={(r) => r.id}
                noHead
                minRowHeight={48}
              />
            </Fragment>
          ))}
        </DeskCard>
      )}
    </>
  );
}

/** A status is a coloured dot with black words; the plain อนุมัติแล้ว is grey words alone. */
function StateCell({ row, slipCheckOn }: { row: PaymentRow; slipCheckOn: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = payState(row, slipCheckOn);
  const tone =
    state === "awaitingSlip" ? theme.waiting : state === "slipConfirmed" ? theme.success : null;
  return (
    <View style={styles.state}>
      {tone && <View style={[styles.dot, { backgroundColor: tone }]} />}
      <Text
        style={[TYPE.subhead, { color: tone ? theme.text : theme.textMuted }]}
        numberOfLines={1}
      >
        {t(STATE_WORDS[state])}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  today: { marginTop: SPACE.l, marginBottom: SPACE.l },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: 40 },
  stat: { flex: 1, minWidth: 0, gap: 4 },
  big: { fontSize: 34, lineHeight: 41, fontVariant: ["tabular-nums"] },
  mid: { fontSize: 22, lineHeight: 28, fontVariant: ["tabular-nums"] },
  dayHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.l,
    paddingTop: SPACE.l,
    paddingBottom: 2,
  },
  dayTitle: { ...TYPE.headline, flex: 1, fontSize: 17 },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  amount: { alignItems: "flex-end", gap: 6 },
  money: { fontVariant: ["tabular-nums"] },
});
