import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sellerLine, sellerName, type ProductInsightRow } from "@/lib/insightPage";
import { formatBaht } from "@/lib/money";
import { useLang, useTheme } from "../AppProviders";
import { NameCell } from "../desk/NameCell";
import { Table, type TableColumn } from "../desk/Table";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Photo } from "../products/parts";
import { RADIUS, SPACE, TYPE } from "../theme";
import { CodeCopy } from "../CodeCopy";

/** The best sellers' card: the rows in the order given, numbered from 1. */
export function SellerList(props: { rows: readonly ProductInsightRow[] }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      {props.rows.map((row, i) => (
        <SellerRow key={row.productId} rank={i + 1} row={row} last={i === props.rows.length - 1} />
      ))}
    </View>
  );
}

const openProduct = (row: ProductInsightRow) =>
  router.push(`/products/${encodeURIComponent(row.productId)}` as never);

interface Ranked {
  rank: number;
  row: ProductInsightRow;
}

/**
 * The best sellers on a computer (DeskInsight board, 4 Nov 2026): the number, photo · name on two
 * lines · code, then ยอดขาย and "ขาย 2 · ดู 64" on the right; a row opens the product. `compact` is
 * ภาพรวม's card (no headings, the two numbers stacked); otherwise ดูทั้งหมด's full table.
 */
export function SellerTable(props: { rows: readonly ProductInsightRow[]; compact?: boolean }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const grey = [TYPE.subhead, styles.nums, styles.end, { color: theme.textMuted }];
  const sales = (r: Ranked) => (
    <Text style={[TYPE.subhead, styles.nums, styles.end, { color: theme.text }]} numberOfLines={1}>
      {formatBaht(r.row.salesSatang)}
    </Text>
  );
  const line = (r: Ranked) => (
    <Text style={grey} numberOfLines={1}>
      {t(sellerLine(r.row))}
    </Text>
  );
  const rank: TableColumn<Ranked> = {
    key: "rank",
    label: "",
    width: 18,
    align: "right",
    cell: (r) => <Text style={grey}>{r.rank}</Text>,
  };
  const name: TableColumn<Ranked> = {
    key: "name",
    label: t({ th: "สินค้า", en: "Product" }),
    cell: (r) => (
      <NameCell
        name={sellerName(r.row)}
        code={r.row.productRef ?? undefined}
        imageKey={r.row.imageKey}
      />
    ),
  };
  const columns: TableColumn<Ranked>[] = props.compact
    ? [
        rank,
        name,
        {
          key: "numbers",
          label: "",
          width: 110,
          align: "right",
          cell: (r) => (
            <>
              {sales(r)}
              {line(r)}
            </>
          ),
        },
      ]
    : [
        rank,
        name,
        {
          key: "sales",
          label: t({ th: "ยอดขาย", en: "Sales" }),
          width: 120,
          align: "right",
          cell: sales,
        },
        { key: "line", label: "", width: 140, align: "right", cell: line },
      ];
  return (
    <Table
      columns={columns}
      rows={props.rows.map((row, i) => ({ rank: i + 1, row }))}
      rowKey={(r) => r.row.productId}
      onPress={(r) => openProduct(r.row)}
      rowLabel={(r) =>
        `${r.rank} ${sellerName(r.row)}, ${formatBaht(r.row.salesSatang)}, ${t(sellerLine(r.row))}`
      }
      noHead={props.compact}
      minRowHeight={64}
    />
  );
}

/**
 * One best seller, as picked (owner, 1 Nov: "C … only keep sales amount, views, order amount"):
 * the number, the photo, the name on one line, its code in grey (4 Nov), then ยอดขาย in its own
 * column and "ขาย 2 · ดู 64" in grey. A tap opens the product's page.
 */
function SellerRow(props: { rank: number; row: ProductInsightRow; last: boolean }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { row } = props;
  const name = sellerName(row);
  const sales = formatBaht(row.salesSatang);
  const line = t(sellerLine(row));
  return (
    <Pressable
      onPress={() => openProduct(row)}
      accessibilityRole="link"
      accessibilityLabel={`${props.rank} ${name}, ${sales}, ${line}`}
      style={({ pressed }) => [
        styles.row,
        !props.last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed && { backgroundColor: theme.hover },
      ]}
    >
      <Text style={[TYPE.subhead, styles.rank, { color: theme.textMuted }]}>{props.rank}</Text>
      <Photo imageKey={row.imageKey} size={48} radius={10} />
      <View style={styles.text}>
        <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>
        {row.productRef ? (
          <CodeCopy code={row.productRef} style={[TYPE.subhead, { color: theme.textMuted }]} />
        ) : null}
        <View style={styles.numbers}>
          <Text
            style={[TYPE.subhead, styles.money, styles.nums, { color: theme.text }]}
            numberOfLines={1}
          >
            {sales}
          </Text>
          <Text
            style={[TYPE.subhead, styles.grow, styles.nums, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {line}
          </Text>
        </View>
      </View>
      <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
  },
  rank: { width: 18, fontWeight: "600", textAlign: "center" },
  text: { flex: 1, minWidth: 0 },
  numbers: { flexDirection: "row", gap: SPACE.m },
  money: { width: 84 },
  grow: { flex: 1, minWidth: 0 },
  nums: { fontVariant: ["tabular-nums"] },
  end: { textAlign: "right" },
});
