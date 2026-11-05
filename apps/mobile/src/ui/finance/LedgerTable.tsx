import type { Phrase } from "@l-shopee/shared/lang";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ledgerLine, type LedgerRow } from "@/lib/financePage";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { NameCell } from "../desk/NameCell";
import { Table, type TableColumn } from "../desk/Table";
import { SPACE, TYPE } from "../theme";

interface LedgerTableProps {
  /** The rows under their day, newest first (financePage byDay). */
  days: readonly { day: number; title: Phrase; rows: LedgerRow[] }[];
  /** What a row opens: the bill, the order, the expense — as on the phone. */
  onOpen: (r: LedgerRow) => void;
}

const rowKey = (r: LedgerRow) =>
  r.kind === "bill" ? r.bill.id : r.kind === "order" ? r.order.id : `e-${r.expense.id}`;

/**
 * A shop's money in and money out on a computer (DeskFinance 3): one table — รายการ, ยอด, กำไร — with
 * a grey band for each day, no clock time. A refunded row says so in กำไร with its grey dot; an
 * expense has no กำไร.
 */
export function LedgerTable({ days, onOpen }: LedgerTableProps) {
  const { t } = useLang();
  const { theme } = useTheme();
  const nums = [TYPE.subhead, styles.nums, { color: theme.text }];
  const columns: TableColumn<LedgerRow>[] = [
    {
      key: "what",
      label: t({ th: "รายการ", en: "Item" }),
      cell: (r) => {
        const line = ledgerLine(r);
        return <NameCell name={t(line.title)} sub={t(line.sub)} />;
      },
    },
    {
      key: "amount",
      label: t({ th: "ยอด", en: "Amount" }),
      width: 140,
      align: "right",
      cell: (r) => (
        <Text style={nums} numberOfLines={1}>
          {ledgerLine(r).amount}
        </Text>
      ),
    },
    {
      key: "profit",
      label: t({ th: "กำไร", en: "Profit" }),
      width: 140,
      align: "right",
      cell: (r) => {
        const line = ledgerLine(r);
        if (line.state) {
          return (
            <View style={styles.state}>
              <View style={[styles.dot, { backgroundColor: theme.textMuted }]} />
              <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
                {t(line.state)}
              </Text>
            </View>
          );
        }
        return (
          <Text style={nums} numberOfLines={1}>
            {line.profit ?? ""}
          </Text>
        );
      },
    },
  ];
  const label = (r: LedgerRow) => {
    const line = ledgerLine(r);
    return `${t(line.title)} ${t(line.sub)} ${line.amount}`;
  };
  return (
    <DeskCard pad={4}>
      {/* The headings once, over every day. */}
      <Table columns={columns} rows={[]} rowKey={rowKey} onPress={onOpen} />
      {days.map((d, i) => (
        <Fragment key={d.day}>
          <View
            style={[
              styles.band,
              { backgroundColor: theme.sidebar, borderColor: theme.border },
              i > 0 && styles.bandTop,
            ]}
          >
            <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(d.title)}</Text>
          </View>
          <Table
            columns={columns}
            rows={d.rows}
            rowKey={rowKey}
            onPress={onOpen}
            rowLabel={label}
            minRowHeight={56}
            noHead
          />
        </Fragment>
      ))}
    </DeskCard>
  );
}

const styles = StyleSheet.create({
  band: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: SPACE.l,
    borderBottomWidth: 1,
  },
  bandTop: { borderTopWidth: 1 },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  nums: { fontVariant: ["tabular-nums"] },
});
