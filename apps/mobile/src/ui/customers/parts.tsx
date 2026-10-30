import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { itemsPreview, monthBars, type StatusTone } from "@/lib/customerPage";
import type { CustomerSummary } from "@/lib/customersApi";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { RADIUS, SPACE, TYPE, type Theme } from "../theme";

const BAR_AREA = 56;
const CHART_HEIGHT = 92;

/** The ลูกค้า summary card (owner picked B): the total, this month and new, and six months of bars. */
export function SummaryCard(props: {
  summary: CustomerSummary;
  unit: { th: string; en: string };
  totalLabel: { th: string; en: string };
  activeLabel: { th: string; en: string };
  newLabel: { th: string; en: string };
  barsLabel: { th: string; en: string };
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const s = props.summary;
  const unit = ` ${t(props.unit)}`;
  const bars = monthBars(s.months);
  return (
    <View style={[styles.card, styles.summary, { backgroundColor: theme.surface }]}>
      <View style={styles.summaryTop}>
        <View style={styles.grow}>
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(props.totalLabel)}</Text>
          <Text style={[styles.big, { color: theme.text }]}>
            {s.total.toLocaleString("en-US")}
            <Text style={TYPE.body}>{unit}</Text>
          </Text>
        </View>
        <View style={styles.end}>
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(props.activeLabel)}</Text>
          <Text style={[styles.mid, { color: theme.text }]}>
            {s.activeThisMonth.toLocaleString("en-US")}
            <Text style={TYPE.subhead}>{unit}</Text>
          </Text>
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
            {`${t(props.newLabel)} ${s.newThisMonth.toLocaleString("en-US")}${unit}`}
          </Text>
        </View>
      </View>
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(props.barsLabel)}</Text>
      <View style={styles.bars} accessible accessibilityLabel={t(props.barsLabel)}>
        {bars.map((b, i) => {
          const now = i === bars.length - 1;
          return (
            <View key={b.key} style={styles.barCol}>
              {now && <Text style={[TYPE.footnote, { color: theme.text }]}>{b.count}</Text>}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, Math.round(BAR_AREA * b.share)),
                    backgroundColor: now ? theme.text : theme.textFaint,
                  },
                ]}
              />
              <Text style={[styles.month, { color: now ? theme.text : theme.textMuted }]}>
                {t(b.label)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A list row like Mail's: bold title with the date on the right, a grey line under it. */
export function ListRow(props: {
  title: string;
  right: string;
  sub: string;
  last: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={props.onPress} accessibilityRole="button" accessibilityLabel={props.title}>
      <View style={[styles.listRow, !props.last && divider(theme)]}>
        <View style={styles.line}>
          <Text style={[TYPE.headline, styles.grow, { color: theme.text }]} numberOfLines={1}>
            {props.title}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{props.right}</Text>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        </View>
        <Text style={[TYPE.subhead, styles.subLine, { color: theme.textMuted }]} numberOfLines={1}>
          {props.sub}
        </Text>
      </View>
    </Pressable>
  );
}

/** A visit's or an order's items: at most 3, then "และอีก N รายการ". */
function ItemLines({ items }: { items: readonly string[] }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { shown, more } = itemsPreview(items);
  return (
    <View style={styles.items}>
      {shown.map((it, i) => (
        <View key={`${i}-${it}`} style={styles.item}>
          <View style={[styles.itemDot, { backgroundColor: theme.textFaint }]} />
          <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>{it}</Text>
        </View>
      ))}
      {more > 0 && (
        <Text style={[TYPE.subhead, styles.more, { color: theme.textMuted }]}>
          {t({ th: `และอีก ${more} รายการ`, en: `and ${more} more` })}
        </Text>
      )}
    </View>
  );
}

/** A card whose head is a tappable line (date or order) over its items. */
export function ItemCard(props: {
  head: ReactNode;
  items: readonly string[];
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const body = (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHead}>
        <View style={[styles.line, styles.grow]}>{props.head}</View>
        {props.onPress && (
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        )}
      </View>
      {props.items.length > 0 ? (
        <>
          <View style={[styles.cardRule, { backgroundColor: theme.border }]} />
          <ItemLines items={props.items} />
        </>
      ) : (
        <View style={styles.cardEnd} />
      )}
    </View>
  );
  return props.onPress ? (
    <Pressable onPress={props.onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function toneOf(tone: StatusTone, theme: Theme): string {
  if (tone === "success") return theme.success;
  if (tone === "waiting") return theme.waiting;
  if (tone === "danger") return theme.primary;
  return theme.textMuted;
}

export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

/** The search box under the summary (drawn in the page, not in the tab bar). */
export function SearchField(props: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <View style={[styles.search, { backgroundColor: theme.segBg }]}>
      <LineIcon d={ICON.search} color={theme.textMuted} size={17} strokeWidth={2} />
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={props.placeholder}
        autoCorrect={false}
        style={[TYPE.body, styles.searchInput, { color: theme.text }]}
      />
      {props.value !== "" && (
        <Pressable
          onPress={() => props.onChange("")}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ล้างคำค้น", en: "Clear search" })}
          hitSlop={8}
        >
          <LineIcon d={ICON.close} color={theme.textMuted} size={15} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}

/** Nothing to show: a round icon, a line in black and one in grey, and maybe one way on. */
export function Empty(props: { icon: string; title: string; detail: string; action?: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.hover }]}>
        <LineIcon d={props.icon} color={theme.text} size={26} strokeWidth={2} />
      </View>
      <Text style={[TYPE.headline, styles.center, { color: theme.text }]}>{props.title}</Text>
      <Text style={[TYPE.subhead, styles.center, { color: theme.textMuted }]}>{props.detail}</Text>
      {props.action}
    </View>
  );
}

const divider = (theme: Theme) => ({ borderBottomWidth: 1, borderBottomColor: theme.border });

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  summary: { marginTop: SPACE.m, padding: SPACE.l, gap: SPACE.m },
  summaryTop: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.l },
  grow: { flex: 1, minWidth: 0 },
  end: { alignItems: "flex-end", gap: 2 },
  big: { fontSize: 34, lineHeight: 41, fontVariant: ["tabular-nums"] },
  mid: { fontSize: 22, lineHeight: 28, fontVariant: ["tabular-nums"] },
  rule: { height: 1 },
  bars: { flexDirection: "row", gap: SPACE.s, alignItems: "flex-end" },
  barCol: {
    flex: 1,
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACE.xs,
  },
  bar: { width: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  month: { fontSize: 11, lineHeight: 14 },
  listRow: {
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    paddingVertical: 10,
    minHeight: 68,
    justifyContent: "center",
  },
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  subLine: { paddingRight: 23 },
  items: { paddingHorizontal: SPACE.l, paddingTop: SPACE.s, paddingBottom: SPACE.m, gap: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  itemDot: { width: 5, height: 5, borderRadius: 3 },
  more: { paddingLeft: 13 },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingHorizontal: SPACE.l,
    paddingTop: SPACE.m,
    paddingBottom: SPACE.s,
  },
  cardRule: { height: 1, marginLeft: SPACE.l },
  cardEnd: { height: SPACE.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  search: {
    marginTop: SPACE.xxl,
    height: 40,
    borderRadius: RADIUS.field,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingHorizontal: SPACE.m - 2,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, outlineStyle: "none" } as never,
  empty: { marginTop: 56, alignItems: "center", gap: SPACE.s, paddingHorizontal: 24 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
});
