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
}) {
  const now = metricValues(props.data.totals);
  const before = metricValues(props.data.previous);
  return (
    <View style={styles.lines}>
      {TILE_LINES.map((line, i) => (
        <View key={line.join()} style={styles.line}>
          {line.map((key) => (
            <Tile
              key={key}
              big={i === 0}
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
        style={[props.big ? TYPE.title1 : TYPE.title2, styles.nums, { color: theme.text }]}
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

const styles = StyleSheet.create({
  lines: { marginTop: SPACE.l, gap: SPACE.s },
  line: { flexDirection: "row", gap: SPACE.s },
  tile: { flex: 1, minWidth: 0, borderRadius: 16, gap: 2 },
  big: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l },
  small: { paddingVertical: 10, paddingHorizontal: SPACE.m },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grow: { flexShrink: 1 },
  nums: { fontVariant: ["tabular-nums"] },
});
