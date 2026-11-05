import { metricValues, type MetricKey } from "@l-shopee/core";
import { StyleSheet, Text, View } from "react-native";
import { changeOf, metricLabel, valueText, type InsightsPayload } from "@/lib/insightPage";
import { useLang, useTheme } from "../AppProviders";
import { RADIUS, SPACE, TYPE } from "../theme";
import { changeColour } from "./Tiles";

/**
 * A list of numbers under its heading (ยอดขาย, การเข้าชม): the name on the left, the number on the
 * right with its ▲ / ▼ against the comparison period under it.
 */
export function MetricList(props: { data: InsightsPayload; keys: readonly MetricKey[] }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const now = metricValues(props.data.totals);
  const before = metricValues(props.data.previous);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      {props.keys.map((key, i) => {
        const change = changeOf(key, now[key], before[key]);
        return (
          <View key={key} style={styles.row}>
            <View
              style={[
                styles.body,
                i < props.keys.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>
                {t(metricLabel(key))}
              </Text>
              <View style={styles.end}>
                <Text style={[TYPE.body, styles.nums, { color: theme.text }]}>
                  {valueText(key, now[key])}
                </Text>
                <Text
                  style={[TYPE.footnote, styles.nums, { color: changeColour(change.tone, theme) }]}
                >
                  {change.text}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The same numbers in a computer card (DeskInsight board): one line each — the name, the number,
 * then its ▲ / ▼ in a column of its own, so the changes line up.
 */
export function MetricRows(props: { data: InsightsPayload; keys: readonly MetricKey[] }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const now = metricValues(props.data.totals);
  const before = metricValues(props.data.previous);
  return (
    <View>
      {props.keys.map((key, i) => {
        const change = changeOf(key, now[key], before[key]);
        return (
          <View
            key={key}
            style={[
              styles.wideRow,
              i < props.keys.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]} numberOfLines={1}>
              {t(metricLabel(key))}
            </Text>
            <Text style={[TYPE.subhead, styles.nums, { color: theme.text }]} numberOfLines={1}>
              {valueText(key, now[key])}
            </Text>
            <Text
              style={[
                TYPE.footnote,
                styles.nums,
                styles.change,
                { color: changeColour(change.tone, theme) },
              ]}
              numberOfLines={1}
            >
              {change.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wideRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  change: { width: 72, textAlign: "right" },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  row: { paddingLeft: SPACE.l },
  body: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: SPACE.s,
    paddingRight: SPACE.l,
  },
  grow: { flex: 1, minWidth: 0 },
  end: { alignItems: "flex-end" },
  nums: { fontVariant: ["tabular-nums"] },
});
