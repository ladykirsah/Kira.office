import { comparisonWindow } from "@l-shopee/core";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  LIST_ROWS,
  PERIOD_OPTIONS,
  compareLine,
  isQuiet,
  quietText,
  sourceShares,
  topSellers,
  type InsightsPayload,
} from "@/lib/insightPage";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { MenuButton } from "../orders/MenuButton";
import { SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { MetricList } from "./MetricList";
import { SellerList } from "./Sellers";
import { SourcesCard } from "./SourcesCard";
import { Tiles } from "./Tiles";
import { TrendChart } from "./TrendChart";
import { useInsights, type Insights } from "./useInsights";

/**
 * ภาพรวม AirPlus (owner approved the drawing, canvas v233, 1 Nov 2026): the period, what it is
 * compared with, the numbers in three lines of tiles that pick the graph's lines, the top five
 * best sellers under the graph, then ยอดขาย, การเข้าชม and ที่มาของการเข้าชม. Owner only (nav.ts).
 */
export function InsightScreen() {
  const h = useInsights();
  useScreenChrome(null, []);
  return (
    <View>
      <PeriodButton h={h} />
      <CompareLine h={h} />
      <Body h={h} />
    </View>
  );
}

/** "วันนี้ ▾" — Orders' small menu button, with the five periods. */
export function PeriodButton({ h }: { h: Insights }) {
  const { t } = useLang();
  const current = PERIOD_OPTIONS.find((o) => o.key === h.period) ?? PERIOD_OPTIONS[0]!;
  return (
    <View style={styles.menus}>
      <MenuButton
        name={t({ th: "ช่วงเวลา", en: "Period" })}
        label={t(current.label)}
        on={false}
        options={PERIOD_OPTIONS}
        value={h.period}
        onPick={h.setPeriod}
      />
    </View>
  );
}

function CompareLine({ h }: { h: Insights }) {
  const { theme } = useTheme();
  const { t } = useLang();
  // From the period itself, so it shows while loading and when loading fails, as drawn.
  const line = compareLine(h.period, h.data?.comparison ?? comparisonWindow(h.period, Date.now()));
  return <Text style={[TYPE.footnote, styles.compare, { color: theme.textMuted }]}>{t(line)}</Text>;
}

/** The waiting, failed and empty pages are the same for the main page and ดูทั้งหมด. */
export function Waiting(props: { h: Insights; children: (data: InsightsPayload) => ReactNode }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { h } = props;
  if (h.failed) {
    return (
      <Empty
        icon={ICON.alert}
        title={t({ th: "ยังโหลดข้อมูลไม่ได้", en: "Could not load the numbers" })}
        detail={t({
          th: "เน็ตอาจหลุด หรือระบบช้าชั่วคราว",
          en: "The connection may be down, or the system is slow for a moment",
        })}
        action={<SmallButton label={t({ th: "ลองใหม่", en: "Try again" })} onPress={h.reload} />}
      />
    );
  }
  if (!h.data) return <ActivityIndicator style={styles.loading} color={theme.textMuted} />;
  return <>{props.children(h.data)}</>;
}

function Body({ h }: { h: Insights }) {
  const { t } = useLang();
  return (
    <Waiting h={h}>
      {(data) =>
        isQuiet(data) ? (
          <Empty icon={ICON.alert} title={t(quietText(h.period))} />
        ) : (
          <Numbers h={h} data={data} />
        )
      }
    </Waiting>
  );
}

function Numbers({ h, data }: { h: Insights; data: InsightsPayload }) {
  const { t } = useLang();
  const top = topSellers(data.products);
  const shares = sourceShares(data.sources);
  return (
    <View>
      <Tiles data={data} lines={h.lines} onTap={h.tapTile} />
      <TrendChart data={data} lines={h.lines} />
      {top.length > 0 && (
        <>
          <Heading
            title={t({ th: "สินค้าขายดี", en: "Best sellers" })}
            more={{
              label: t({ th: "ดูทั้งหมด", en: "See all" }),
              onPress: () => router.push(`/insights/products?period=${h.period}` as never),
            }}
          />
          <SellerList rows={top} />
        </>
      )}
      <Heading title={t({ th: "ยอดขาย", en: "Sales" })} />
      <MetricList data={data} keys={LIST_ROWS.money} />
      <Heading title={t({ th: "การเข้าชม", en: "Visits" })} />
      <MetricList data={data} keys={LIST_ROWS.traffic} />
      {shares.length > 0 && (
        <>
          <Heading title={t({ th: "ที่มาของการเข้าชม", en: "Where visitors came from" })} />
          <SourcesCard shares={shares} />
        </>
      )}
    </View>
  );
}

function Heading(props: { title: string; more?: { label: string; onPress: () => void } }) {
  const { theme } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[TYPE.title2, styles.grow, { color: theme.text }]} accessibilityRole="header">
        {props.title}
      </Text>
      {props.more && (
        <Pressable onPress={props.more.onPress} accessibilityRole="link" hitSlop={8}>
          <Text style={[TYPE.body, { color: theme.primary }]}>{props.more.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menus: { flexDirection: "row" },
  compare: { marginTop: SPACE.s, marginHorizontal: 2 },
  loading: { marginTop: SPACE.xxxl },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: SPACE.xxl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
  },
  grow: { flex: 1 },
});
