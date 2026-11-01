import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sellerLine, sellerName, type ProductInsightRow } from "@/lib/insightPage";
import { formatBaht } from "@/lib/money";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Photo } from "../products/parts";
import { RADIUS, SPACE, TYPE } from "../theme";

/** The best sellers' card: the rows in the order given, numbered from 1. */
export function SellerList(props: { rows: readonly ProductInsightRow[] }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {props.rows.map((row, i) => (
        <SellerRow key={row.productId} rank={i + 1} row={row} last={i === props.rows.length - 1} />
      ))}
    </View>
  );
}

/**
 * One best seller, as picked (owner, 1 Nov: "C … only keep sales amount, views, order amount"):
 * the number, the photo, the name on one line, then ยอดขาย in its own column and "ขาย 2 · ดู 64" in
 * grey. A tap opens the product's page.
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
      onPress={() => router.push(`/products/${encodeURIComponent(row.productId)}` as never)}
      accessibilityRole="button"
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
});
