import { metricValues, type MetricKey } from "@l-shopee/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  TILE_LINES,
  changeOf,
  metricLabel,
  valueText,
  type Change,
  type InsightsPayload,
} from "@/lib/insightPage";
import { useLang, useTheme } from "../AppProviders";
import type { Theme } from "../theme";
import { SPACE, TYPE } from "../theme";

/** ▲ green when the shop did better, ▼ red when worse (owner, 1 Nov); a dash stays grey. */
export function changeColour(tone: Change["tone"], theme: Theme): string {
  if (tone === "better") return theme.success;
  if (tone === "worse") return theme.danger;
  return theme.textMuted;
}

/** The colour of a picked tile's dot and its line in the graph: first blue, second orange. */
export function lineColour(index: number, theme: Theme): string {
  return index === 0 ? theme.lineA : theme.lineB;
}

/**
 * The numbers at the top, three lines (canvas v233): ยอดขาย · กำไร big, then มองเห็นสินค้า ·
 * ผู้เข้าชม · เพิ่มลงตะกร้า, then จำนวนออเดอร์ · เฉลี่ยต่อออเดอร์. Each tile is a button: tapping
 * draws its line in the graph, and its dot says which line it is.
 */
export function Tiles(props: {
  data: InsightsPayload;
  lines: readonly MetricKey[];
  onTap: (key: MetricKey) => void;
  /**
   * A computer (DeskInsight board, 4 Nov 2026): the three groups side by side in one row, each tile
   * with a thin line, the money group a little wider.
   */
  wide?: boolean;
}) {
  const now = metricValues(props.data.totals);
  const before = metricValues(props.data.previous);
  return (
    <View style={props.wide ? styles.wideLines : styles.lines}>
      {TILE_LINES.map((line, i) => (
        <View
          key={line.join()}
          style={[
            styles.line,
            props.wide && { flex: line.length * (i === 0 ? BIG_SHARE : 1), minWidth: 0 },
          ]}
        >
          {line.map((key) => (
            <Tile
              key={key}
              big={i === 0}
              wide={props.wide}
              tileKey={key}
              value={now[key]}
              change={changeOf(key, now[key], before[key])}
              picked={props.lines.indexOf(key)}
              onPress={() => props.onTap(key)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile(props: {
  big: boolean;
  wide?: boolean;
  tileKey: MetricKey;
  value: number;
  change: Change;
  /** Which line of the graph it draws, or -1. */
  picked: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const label = t(metricLabel(props.tileKey));
  const value = valueText(props.tileKey, props.value);
  const on = props.picked >= 0;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label} ${value} ${props.change.text}`}
      accessibilityHint={t({ th: "แตะเพื่อดูในกราฟ", en: "Tap to show it in the graph" })}
      style={({ pressed }) => [
        styles.tile,
        props.big ? styles.big : styles.small,
        props.wide && [styles.wideTile, { borderColor: theme.border }],
        { backgroundColor: pressed ? theme.hover : theme.surface },
      ]}
    >
      <View style={styles.label}>
        {on && <View style={[styles.dot, { backgroundColor: lineColour(props.picked, theme) }]} />}
        <Text style={[TYPE.footnote, styles.grow, { color: theme.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={[
          props.big ? TYPE.title1 : TYPE.title2,
          props.wide && (props.big ? styles.wideBig : styles.wideSmall),
          styles.nums,
          { color: theme.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={[TYPE.footnote, styles.nums, { color: changeColour(props.change.tone, theme) }]}
        numberOfLines={1}
      >
        {props.change.text}
      </Text>
    </Pressable>
  );
}

/** The money tiles are a little wider than the others on a computer (as drawn). */
const BIG_SHARE = 1.35;

const styles = StyleSheet.create({
  lines: { marginTop: SPACE.l, gap: SPACE.s },
  wideLines: { flexDirection: "row", gap: SPACE.xl },
  wideTile: { borderRadius: 12, borderWidth: 1, paddingVertical: SPACE.m, paddingHorizontal: 14 },
  wideBig: { fontSize: 24, lineHeight: 31 },
  wideSmall: { fontSize: 19, lineHeight: 25 },
  line: { flexDirection: "row", gap: SPACE.s },
  tile: { flex: 1, minWidth: 0, borderRadius: 16, gap: 2 },
  big: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l },
  small: { paddingVertical: 10, paddingHorizontal: SPACE.m },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grow: { flexShrink: 1 },
  nums: { fontVariant: ["tabular-nums"] },
});
