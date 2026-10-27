import { StyleSheet, Text, View } from "react-native";
import type { BillDoc } from "@/lib/mechanicBill";
import { formatBaht } from "@/lib/money";
import { billDate } from "@/lib/scanSale";
import { useLang, useTheme } from "../AppProviders";
import { RADIUS, SPACE, TYPE } from "../theme";

const PAID_BY = {
  cash: { th: "เงินสด", en: "cash" },
  promptpay: { th: "พร้อมเพย์ (QR)", en: "PromptPay (QR)" },
} as const;

/**
 * The bill a mechanic gets (owner's pick, option C, 2026-10-26): the shop's name on top, the date,
 * the time with the bill number, the items, then the total and how it was paid on one line.
 */
export function BillCard({ bill }: { bill: BillDoc }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const when = billDate(bill.at);
  const rule = [styles.rule, { backgroundColor: theme.border }];
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.shop, { color: theme.text }]}>{bill.shopName}</Text>
      <Text style={[styles.date, { color: theme.text }]}>
        {t({ th: `วันที่ ${when.date}`, en: `Date ${when.date}` })}
      </Text>
      <Text style={[styles.small, { color: theme.textMuted }]}>
        {t({
          th: `${when.time} · บิลเงินสด เลขที่ ${bill.saleNumber}`,
          en: `${when.time} · Cash bill no. ${bill.saleNumber}`,
        })}
      </Text>
      <View style={rule} />
      {bill.lines.map((l, i) => (
        <View key={`${l.name}-${i}`} style={styles.line}>
          <View style={styles.lineText}>
            <Text style={[styles.item, { color: theme.text }]}>{l.name}</Text>
            <Text style={[styles.small, { color: theme.textMuted }]}>
              {formatBaht(l.unitSatang)} × {l.qty}
            </Text>
          </View>
          <Text style={[styles.item, { color: theme.text }]}>{formatBaht(l.totalSatang)}</Text>
        </View>
      ))}
      <View style={[...rule, styles.ruleTight]} />
      <View style={[styles.line, styles.totalLine]}>
        <Text style={[styles.item, styles.lineText, { color: theme.text }]} numberOfLines={1}>
          {t({ th: "รวมทั้งสิ้น ", en: "Total " })}
          <Text style={styles.total}>{formatBaht(bill.totalSatang)}</Text>
        </Text>
        <Text style={[styles.item, { color: theme.text }]} numberOfLines={1}>
          {t({ th: "ชำระด้วย ", en: "Paid by " })}
          {t(PAID_BY[bill.paidBy])}
        </Text>
      </View>
      <View style={rule} />
      <Text style={[styles.small, styles.thanks, { color: theme.textMuted }]}>
        {t({ th: "ขอบคุณที่ใช้บริการ", en: "Thank you" })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACE.l,
    borderRadius: RADIUS.card,
    paddingVertical: 18,
    paddingHorizontal: SPACE.l,
  },
  shop: { ...TYPE.title2 },
  date: { ...TYPE.subhead, marginTop: SPACE.xs },
  small: { ...TYPE.footnote, fontVariant: ["tabular-nums"] },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  ruleTight: { marginTop: 6, marginBottom: SPACE.m },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9 },
  lineText: { flex: 1, minWidth: 0 },
  totalLine: { alignItems: "baseline" },
  item: { ...TYPE.subhead, fontVariant: ["tabular-nums"] },
  total: { ...TYPE.headline },
  thanks: { marginTop: 10 },
});
