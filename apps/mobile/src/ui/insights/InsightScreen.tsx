import { comparisonWindow } from "@l-shopee/core";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
import { DeskCard } from "../desk/DeskCard";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { MenuButton } from "../orders/MenuButton";
import { SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SectionHeading } from "../SectionHeading";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { MetricList, MetricRows } from "./MetricList";
import { SellerList, SellerTable } from "./Sellers";
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
  const wide = useWide();
  // A computer shows the numbers across the full width (DeskInsight board, 4 Nov 2026).
  useScreenChrome(null, [], { layout: "full" });
  if (wide) {
    return (
      <View>
        <View style={styles.wideTop}>
          <CompareLine h={h} wide />
          <PeriodChoice h={h} />
        </View>
        <Body h={h} wide />
      </View>
    );
  }
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

/** On a computer the five periods sit side by side, one tap each (DeskInsight board). */
export function PeriodChoice({ h }: { h: Insights }) {
  const { t } = useLang();
  return (
    <View style={styles.periods}>
      <Segmented
        label={t({ th: "ช่วงเวลา", en: "Period" })}
        options={PERIOD_OPTIONS.map((o) => ({ value: o.key, label: t(o.label) }))}
        value={h.period}
        onChange={h.setPeriod}
      />
    </View>
  );
}

function CompareLine({ h, wide }: { h: Insights; wide?: boolean }) {
  const { theme } = useTheme();
  const { t } = useLang();
  // From the period itself, so it shows while loading and when loading fails, as drawn.
  const line = compareLine(h.period, h.data?.comparison ?? comparisonWindow(h.period, Date.now()));
  return (
    <Text style={[TYPE.footnote, wide ? styles.grow : styles.compare, { color: theme.textMuted }]}>
      {t(line)}
    </Text>
  );
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

function Body({ h, wide }: { h: Insights; wide?: boolean }) {
  const { t } = useLang();
  return (
    <Waiting h={h}>
      {(data) =>
        isQuiet(data) ? (
          <Empty icon={ICON.alert} title={t(quietText(h.period))} />
        ) : wide ? (
          <WideNumbers h={h} data={data} />
        ) : (
          <Numbers h={h} data={data} />
        )
      }
    </Waiting>
  );
}

const seeAll = (h: Insights) => router.push(`/insights/products?period=${h.period}` as never);

/**
 * The computer page (DeskInsight board): the tiles and the graph in one card on top; under it the
 * five best sellers, ยอดขาย and การเข้าชม, and ที่มาของการเข้าชม side by side.
 */
function WideNumbers({ h, data }: { h: Insights; data: InsightsPayload }) {
  const { t } = useLang();
  const top = topSellers(data.products);
  const shares = sourceShares(data.sources);
  return (
    <View style={styles.wideBody}>
      <DeskCard pad={18}>
        <Tiles data={data} lines={h.lines} onTap={h.tapTile} wide />
        <TrendChart data={data} lines={h.lines} bare />
      </DeskCard>
      <View style={styles.wideRow}>
        {top.length > 0 && (
          <DeskCard
            title={t({ th: "สินค้าขายดี", en: "Best sellers" })}
            action={{ label: t({ th: "ดูทั้งหมด", en: "See all" }), onPress: () => seeAll(h) }}
            pad={4}
            flex={1.55}
          >
            <SellerTable rows={top} compact />
          </DeskCard>
        )}
        <View style={styles.wideMiddle}>
          <DeskCard title={t({ th: "ยอดขาย", en: "Sales" })} pad={16}>
            <MetricRows data={data} keys={LIST_ROWS.money} />
          </DeskCard>
          <DeskCard title={t({ th: "การเข้าชม", en: "Visits" })} pad={16}>
            <MetricRows data={data} keys={LIST_ROWS.traffic} />
          </DeskCard>
        </View>
        {shares.length > 0 && (
          <DeskCard
            title={t({ th: "ที่มาของการเข้าชม", en: "Where visitors came from" })}
            pad={16}
            flex={1}
          >
            <SourcesCard shares={shares} bare />
          </DeskCard>
        )}
      </View>
    </View>
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
          <SectionHeading
            title={t({ th: "สินค้าขายดี", en: "Best sellers" })}
            more={{
              label: t({ th: "ดูทั้งหมด", en: "See all" }),
              onPress: () => seeAll(h),
            }}
          />
          <SellerList rows={top} />
        </>
      )}
      <SectionHeading title={t({ th: "ยอดขาย", en: "Sales" })} />
      <MetricList data={data} keys={LIST_ROWS.money} />
      <SectionHeading title={t({ th: "การเข้าชม", en: "Visits" })} />
      <MetricList data={data} keys={LIST_ROWS.traffic} />
      {shares.length > 0 && (
        <>
          <SectionHeading title={t({ th: "ที่มาของการเข้าชม", en: "Where visitors came from" })} />
          <SourcesCard shares={shares} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menus: { flexDirection: "row" },
  wideTop: { flexDirection: "row", alignItems: "center", gap: SPACE.l, marginBottom: SPACE.l },
  periods: { width: 500, flexShrink: 1 },
  grow: { flex: 1, minWidth: 0 },
  wideBody: { gap: SPACE.xl },
  wideRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xl },
  wideMiddle: { flex: 1, minWidth: 0, gap: SPACE.xl },
  compare: { marginTop: SPACE.s, marginHorizontal: 2 },
  loading: { marginTop: SPACE.xxxl },
});
