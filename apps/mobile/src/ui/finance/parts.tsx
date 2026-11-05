import type { Phrase } from "@l-shopee/shared/lang";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { changeLine, minus, money, periodRange, type Range } from "@/lib/financePage";
import { DATE_PRESETS, rangeLabel, type CustomRange, type DatePreset } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { DeskCard } from "../desk/DeskCard";
import { MenuButton } from "../orders/MenuButton";
import { RangeSheet } from "../orders/RangeSheet";
import { Divider } from "../products/parts";
import { Chevron } from "../staff/parts";
import { SPACE, TYPE } from "../theme";
import { Dot } from "./FinanceGraph";

export const BASE = "/sales";

/** The period lives in the page address, so a shop's page opens on the same one (and back keeps it). */
export function usePeriod() {
  const params = useLocalSearchParams<{ p?: string; from?: string; to?: string }>();
  const preset: DatePreset = DATE_PRESETS.some((d) => d.key === params.p)
    ? (params.p as DatePreset)
    : "month";
  const from = Number(params.from);
  const to = Number(params.to);
  const custom: CustomRange | null =
    preset === "custom" && from > 0 && to > 0 ? { from, to } : null;
  const [now] = useState(() => Date.now());
  const range: Range = useMemo(
    () => periodRange(preset, custom, now),
    // custom is rebuilt each render; its two numbers are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, custom?.from, custom?.to, now],
  );
  const label: Phrase =
    preset === "custom" && custom
      ? rangeLabel(custom)
      : (DATE_PRESETS.find((d) => d.key === preset) ?? DATE_PRESETS[3]!).label;
  const query = `p=${preset}${custom ? `&from=${custom.from}&to=${custom.to}` : ""}`;
  return { preset, custom, range, label, now, query };
}

/**
 * เดือนนี้ ▾ — Orders' period words; กำหนดเอง… opens the built two-day sheet. `inline`: it sits on the
 * title's line (a computer's shop page), with no space above it.
 */
export function PeriodMenu({
  period,
  inline,
}: {
  period: ReturnType<typeof usePeriod>;
  inline?: boolean;
}) {
  const { t } = useLang();
  const [picking, setPicking] = useState(false);
  return (
    <View style={[styles.menus, inline && styles.inline]}>
      <MenuButton
        name={t({ th: "ช่วงวันที่", en: "Dates" })}
        label={t(period.label)}
        on={false}
        options={DATE_PRESETS}
        value={period.preset}
        onPick={(p) =>
          p === "custom" ? setPicking(true) : router.setParams({ p, from: "", to: "" })
        }
      />
      {picking && (
        <RangeSheet
          range={period.custom}
          now={period.now}
          onClose={() => setPicking(false)}
          onApply={(c) => {
            setPicking(false);
            router.setParams({ p: "custom", from: String(c.from), to: String(c.to) });
          }}
        />
      )}
    </View>
  );
}

/**
 * รายได้ (with the change against the period before) and กำไร, side by side. While the graph draws
 * both, each card carries its line's colour as a dot, the way ภาพรวม AirPlus's tiles do.
 */
export function HeroCards(props: {
  revenue: number;
  profit: number;
  previous: number | null;
  dots: boolean;
  /**
   * A computer (DeskFinance 1, 3): the numbers stand one under another inside the summary card,
   * with no card of their own.
   */
  stacked?: boolean;
  /** A shop's page on a computer: its ค่าใช้จ่าย as a third number (the phone's own row). */
  expense?: number;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const change = changeLine(props.revenue, props.previous);
  const card = (label: Phrase, value: string, under: ReactNode, colour: string | null) => (
    <View
      style={
        props.stacked
          ? styles.stat
          : [
              styles.hero,
              {
                backgroundColor: theme.surface,
                borderWidth: theme.cardLine,
                borderColor: theme.border,
              },
            ]
      }
    >
      <View style={styles.label}>
        {props.dots && colour && <Dot colour={colour} />}
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(label)}</Text>
      </View>
      <Text style={[styles.big, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {under}
    </View>
  );
  return (
    <View style={props.stacked ? styles.stats : styles.heroes}>
      {card(
        { th: "รายได้", en: "Revenue" },
        money(props.revenue),
        change ? (
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
            <Text style={{ color: change.tone === "good" ? theme.success : theme.danger }}>
              {change.arrow}
            </Text>
            {t({ th: " จากช่วงก่อนหน้า", en: " vs the period before" })}
          </Text>
        ) : null,
        theme.lineA,
      )}
      {card({ th: "กำไร", en: "Profit" }, money(props.profit), null, theme.lineB)}
      {props.expense !== undefined &&
        card({ th: "ค่าใช้จ่าย", en: "Expenses" }, minus(props.expense), null, null)}
    </View>
  );
}

/**
 * The top of การเงิน on a computer (DeskFinance 1, 3, Mercury's transactions page): the numbers on the
 * left, a hairline, and the graph across the rest, in one card.
 */
export function DeskSummary(props: { stats: ReactNode; graph: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.deskSummary}>
      <DeskCard>
        <View style={styles.summaryRow}>
          <View style={[styles.statsColumn, { borderRightColor: theme.border }]}>
            {props.stats}
          </View>
          <View style={styles.grow}>{props.graph}</View>
        </View>
      </DeskCard>
    </View>
  );
}

/** One row of a money list: what and when on the left, the amount (and one grey line) on the right. */
export function MoneyRow(props: {
  title: string;
  sub: string;
  amount: string;
  under?: string | null;
  /** "● คืนเงินแล้ว" — said once, with its grey dot. */
  dot?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const body = (
    <View style={styles.row}>
      <View style={styles.grow}>
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={1}>
          {props.title}
        </Text>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
          {props.sub}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[TYPE.body, styles.amount, { color: theme.text }]}>{props.amount}</Text>
        {props.under ? (
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
            {props.dot ? "● " : ""}
            {props.under}
          </Text>
        ) : null}
      </View>
      {props.onPress && <Chevron />}
    </View>
  );
  return (
    <View>
      {props.onPress ? (
        <Pressable onPress={props.onPress} accessibilityRole="button">
          {body}
        </Pressable>
      ) : (
        body
      )}
      {!props.last && <Divider />}
    </View>
  );
}

export function SectionTitle({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.title2, styles.section, { color: theme.text }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

export function DayTitle({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.footnote, styles.day, { color: theme.textMuted }]}>{text}</Text>;
}

export function Loading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { theme } = useTheme();
  return failed ? (
    <Retry onPress={onRetry} />
  ) : (
    <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
  );
}

export function Nothing({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.subhead, styles.none, { color: theme.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  menus: { marginTop: SPACE.s, flexDirection: "row" },
  inline: { marginTop: 0 },
  stats: { gap: 22 },
  stat: { gap: 2 },
  deskSummary: { marginTop: SPACE.l },
  summaryRow: { flexDirection: "row", alignItems: "stretch", gap: SPACE.xxl },
  statsColumn: { width: 250, flexShrink: 0, paddingRight: SPACE.xxl, borderRightWidth: 1 },
  heroes: { marginTop: SPACE.l, flexDirection: "row", gap: SPACE.s },
  hero: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: SPACE.l,
    paddingVertical: 14,
    gap: 2,
  },
  big: { fontSize: 26, lineHeight: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  row: {
    minHeight: 60,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: "flex-end" },
  amount: { fontWeight: "600", fontVariant: ["tabular-nums"] },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  section: { marginTop: 28, marginBottom: SPACE.m, marginHorizontal: 2 },
  day: { marginTop: SPACE.l, marginBottom: SPACE.s, marginHorizontal: 2 },
  none: { textAlign: "center", marginTop: SPACE.xxl, marginHorizontal: SPACE.l },
});
