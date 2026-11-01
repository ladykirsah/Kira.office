import { StyleSheet, Text, View } from "react-native";
import type { SourceShare } from "@/lib/insightPage";
import { useLang, useTheme } from "../AppProviders";
import { RADIUS, SPACE, TYPE } from "../theme";

/**
 * ที่มาของการเข้าชม, the owner's merge of A and B (1 Nov: "A for clear graph and coloring, B is the
 * big % to catch"): one coloured bar for the whole split on top, then each source with its big %
 * first, a dot of its bar colour before its name, and its people and views in grey.
 */
export function SourcesCard(props: { shares: readonly SourceShare[] }) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.barBox} aria-hidden>
        <View style={styles.bar}>
          {props.shares.map((s) => (
            <View key={s.source} style={{ flex: s.visitors, backgroundColor: s.colour }} />
          ))}
        </View>
      </View>
      {props.shares.map((s, i) => {
        const people = t({
          th: `${s.visitors.toLocaleString("en-US")} คน · มองเห็น ${s.views.toLocaleString("en-US")}`,
          en: `${s.visitors.toLocaleString("en-US")} people · ${s.views.toLocaleString("en-US")} views`,
        });
        return (
          <View
            key={s.source}
            style={styles.row}
            accessible
            accessibilityLabel={`${t(s.label)} ${s.pct}%, ${people}`}
          >
            <Text style={[TYPE.title2, styles.pct, { color: theme.text }]}>{s.pct}%</Text>
            <View
              style={[
                styles.body,
                i < props.shares.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <View style={styles.name}>
                <View style={[styles.dot, { backgroundColor: s.colour }]} />
                <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={1}>
                  {t(s.label)}
                </Text>
              </View>
              <Text
                style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]}
                numberOfLines={1}
              >
                {people}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  barBox: { paddingTop: SPACE.l, paddingHorizontal: SPACE.l, paddingBottom: 6 },
  bar: { height: 12, borderRadius: 6, overflow: "hidden", flexDirection: "row", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.m, paddingLeft: SPACE.l },
  pct: { width: 56, fontVariant: ["tabular-nums"] },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    justifyContent: "center",
    paddingVertical: 10,
    paddingRight: SPACE.l,
  },
  name: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nums: { fontVariant: ["tabular-nums"] },
});
