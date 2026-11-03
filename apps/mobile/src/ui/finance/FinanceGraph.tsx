import type { Phrase } from "@l-shopee/shared/lang";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import {
  graphScale,
  graphSeries,
  graphStarts,
  graphStep,
  graphTicks,
  graphTop,
  runningTotals,
  stepTitle,
  type Money,
  type Step,
} from "@/lib/financeChart";
import { money, type Range } from "@/lib/financePage";
import { niceMax, nearestBucket } from "@/lib/insightChart";
import { MONTHS_EN, MONTHS_TH, type DatePreset } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { tapX } from "../insights/TrendChart";
import { RADIUS, SPACE, TYPE } from "../theme";

const PLOT = 132;
/** Room left and right so a line's end and its dot are not cut off. */
const EDGE = 5;
/** A week or six months reads as points, not a bent wire. */
const DOTS_UP_TO = 14;

const UNIT: Record<Step, Phrase> = {
  hour: { th: "ต่อชั่วโมง", en: "Per hour" },
  day: { th: "ต่อวัน", en: "Per day" },
  week: { th: "ต่อสัปดาห์", en: "Per week" },
  month: { th: "ต่อเดือน", en: "Per month" },
};

/**
 * The graph under รายได้ / กำไร (canvas v297): it follows the period — by hour, day, week or month,
 * and เดือนนี้ added up against last month. Blue = รายได้, orange = กำไร (after expenses), dashed =
 * last month. A tap puts that point's numbers on the graph's top line; a second tap clears them.
 */
export function FinanceGraph(props: {
  preset: DatePreset;
  range: Range;
  now: number;
  points: readonly Money[];
  /** เดือนนี้ only: last month's points, for the dashed line. */
  lastMonth: readonly Money[];
}) {
  return graphStep(props.preset, props.range) === "running" ? (
    <Running points={props.points} lastMonth={props.lastMonth} now={props.now} />
  ) : (
    <Lines {...props} />
  );
}

/** True when the graph draws รายได้ and กำไร, so the two money cards carry the line colours. */
export const graphHasTwoLines = (preset: DatePreset, range: Range) =>
  graphStep(preset, range) !== "running";

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

function Lines(props: { preset: DatePreset; range: Range; now: number; points: readonly Money[] }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width, onLayout } = useWidth();
  const [tapped, setTapped] = useState<number | null>(null);
  const step = graphStep(props.preset, props.range) as Step;
  // ทุกวัน starts at the very beginning: draw from the first money there is.
  const first = props.points.length ? Math.min(...props.points.map((p) => p.at)) : null;
  const from = props.range.from > 0 ? props.range.from : first;
  if (from === null) return null;
  const starts = graphStarts(step, { from, to: props.range.to });
  const { revenue, profit } = graphSeries(props.points, starts, props.range.to);
  const scale = graphScale([revenue, profit]);
  const n = starts.length;
  const plotWidth = Math.max(0, width - EDGE * 2);
  const x = (i: number) => EDGE + (n <= 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
  const y = (v: number) => ((scale.max - v) / (scale.max - scale.min)) * (PLOT - 2) + 1;
  const line = (vals: readonly number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const at = tapped != null && tapped < n ? tapped : null;
  const colours = [theme.lineA, theme.lineB];

  const top =
    at != null ? (
      <Readout
        title={t(stepTitle(starts[at]!, step, props.range.to))}
        items={[
          {
            mark: <Dot colour={theme.lineA} />,
            text: `${t({ th: "รายได้", en: "Revenue" })} ${money(revenue[at]!)}`,
          },
          {
            mark: <Dot colour={theme.lineB} />,
            text: `${t({ th: "กำไร", en: "Profit" })} ${money(profit[at]!)}`,
          },
        ]}
      />
    ) : (
      <TopLine left={t(UNIT[step])} right={topValue(scale.max, [revenue, profit])} />
    );

  return (
    <GraphCard top={top}>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => {
          const i = nearestBucket(tapX(e) - EDGE, plotWidth, n);
          setTapped((now) => (now === i ? null : i));
        }}
        accessibilityRole="button"
        accessibilityLabel={t({
          th: "กราฟรายได้และกำไร แตะเพื่อดูตัวเลข",
          en: "Graph of revenue and profit, tap to read",
        })}
        style={styles.plot}
      >
        {width > 0 && (
          <Svg width={width} height={PLOT} aria-hidden>
            <Grid width={width} colour={theme.border} />
            {scale.min < 0 && (
              <Line
                x1={0}
                x2={width}
                y1={y(0)}
                y2={y(0)}
                stroke={theme.textFaint}
                strokeWidth={1}
              />
            )}
            {at != null && (
              <Line
                x1={x(at)}
                x2={x(at)}
                y1={0}
                y2={PLOT}
                stroke={theme.textFaint}
                strokeWidth={1}
              />
            )}
            {[revenue, profit].map((vals, k) => (
              <Polyline
                key={k}
                points={line(vals)}
                fill="none"
                stroke={colours[k]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {[revenue, profit].map((vals, k) =>
              vals.map((v, i) =>
                n <= DOTS_UP_TO || i === at ? (
                  <Circle
                    key={`${k}-${i}`}
                    cx={x(i)}
                    cy={y(v)}
                    r={i === at ? 5 : 4}
                    fill={colours[k]}
                    stroke={theme.surface}
                    strokeWidth={2}
                  />
                ) : null,
              ),
            )}
          </Svg>
        )}
      </Pressable>
      <Ticks
        width={plotWidth}
        ticks={graphTicks(starts, step, props.now).map((tick) => ({
          left: x(tick.index),
          label: t(tick.label),
        }))}
      />
    </GraphCard>
  );
}

function Running(props: { points: readonly Money[]; lastMonth: readonly Money[]; now: number }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width, onLayout } = useWidth();
  const [tapped, setTapped] = useState<number | null>(null);
  const totals = runningTotals(props.points, props.lastMonth, props.now);
  const max = niceMax([...totals.now, ...totals.before]);
  const plotWidth = Math.max(0, width - EDGE * 2);
  // Last month can be a day longer than this one (31 against 30): the axis holds the longer.
  const span = Math.max(totals.days, totals.before.length);
  const x = (day: number) => EDGE + ((day - 1) / (span - 1)) * plotWidth;
  const y = (v: number) => ((max - v) / max) * (PLOT - 2) + 1;
  const line = (vals: readonly number[]) => vals.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
  const today = totals.now.length;
  const month = new Date(props.now).getMonth();
  const at = tapped != null && tapped <= span ? tapped : null;
  // The blue dot sits on the tapped day, or on today when the tap is past today (or none).
  const dotDay = at != null && at <= today ? at : today;

  const dashed = <DashMark colour={theme.textMuted} />;
  const top =
    at != null ? (
      <Readout
        title={t({ th: `วันที่ ${at}`, en: `Day ${at}` })}
        items={[
          ...(at <= today
            ? [{ mark: <Dot colour={theme.lineA} />, text: money(totals.now[at - 1]!) }]
            : []),
          ...(at <= totals.before.length
            ? [{ mark: dashed, text: money(totals.before[at - 1]!) }]
            : []),
        ]}
      />
    ) : (
      <TopLine
        left={t({ th: `สะสม ถึงวันที่ ${today}`, en: `Added up to day ${today}` })}
        right={topValue(max, [totals.now, totals.before])}
      />
    );
  const ahead = totals.ahead >= 0;

  return (
    <GraphCard top={top}>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => {
          const day = nearestBucket(tapX(e) - EDGE, plotWidth, span) + 1;
          setTapped((now) => (now === day ? null : day));
        }}
        accessibilityRole="button"
        accessibilityLabel={t({
          th: "กราฟรายได้สะสม เดือนนี้เทียบเดือนก่อน แตะเพื่อดูตัวเลข",
          en: "Revenue added up, this month against last month, tap to read",
        })}
        style={styles.plot}
      >
        {width > 0 && (
          <Svg width={width} height={PLOT} aria-hidden>
            <Grid width={width} colour={theme.border} />
            {at != null && (
              <Line
                x1={x(at)}
                x2={x(at)}
                y1={0}
                y2={PLOT}
                stroke={theme.textFaint}
                strokeWidth={1}
              />
            )}
            <Polyline
              points={line(totals.before)}
              fill="none"
              stroke={theme.textMuted}
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Polyline
              points={line(totals.now)}
              fill="none"
              stroke={theme.lineA}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle
              cx={x(dotDay)}
              cy={y(totals.now[dotDay - 1] ?? 0)}
              r={5}
              fill={theme.lineA}
              stroke={theme.surface}
              strokeWidth={2}
            />
          </Svg>
        )}
      </Pressable>
      <Ticks
        width={plotWidth}
        ticks={[1, 8, 15, 22, totals.days].map((day) => ({
          left: x(day),
          label:
            day === totals.days
              ? t({ th: `${day} ${MONTHS_TH[month]}`, en: `${day} ${MONTHS_EN[month]}` })
              : String(day),
        }))}
      />
      <View style={styles.legend}>
        <View style={styles.key}>
          <Dot colour={theme.lineA} />
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
            {t({ th: "เดือนนี้", en: "This month" })}
          </Text>
        </View>
        <View style={styles.key}>
          {dashed}
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
            {t({ th: "เดือนก่อน", en: "Last month" })}
          </Text>
        </View>
        <View style={styles.grow} />
        <Text style={[TYPE.footnote, styles.nums, { color: theme.textMuted }]}>
          {ahead
            ? t({ th: "นำเดือนก่อน ", en: "Ahead by " })
            : t({ th: "ตามเดือนก่อน ", en: "Behind by " })}
          <Text style={{ color: ahead ? theme.success : theme.danger }}>
            {ahead ? "▲" : "▼"}
            {money(Math.abs(totals.ahead))}
          </Text>
        </Text>
      </View>
    </GraphCard>
  );
}

/** The top line's number, or nothing when the period has no money to scale (not "฿0.01"). */
const topValue = (max: number, series: readonly (readonly number[])[]) => {
  const top = graphTop(max, series);
  return top === null ? "" : money(top);
};

function GraphCard(props: { top: ReactNode; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.top}>{props.top}</View>
      {props.children}
    </View>
  );
}

function TopLine(props: { left: string; right: string }) {
  const { theme } = useTheme();
  return (
    <>
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{props.left}</Text>
      <Text style={[TYPE.footnote, styles.nums, { color: theme.textMuted }]}>{props.right}</Text>
    </>
  );
}

/** A tap's numbers, where the top line was: nothing floats over the lines. */
function Readout(props: { title: string; items: { mark: ReactNode; text: string }[] }) {
  const { theme } = useTheme();
  return (
    <>
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{props.title}</Text>
      <View style={styles.items}>
        {props.items.map((item) => (
          <View key={item.text} style={styles.key}>
            {item.mark}
            <Text style={[TYPE.footnote, styles.strong, styles.nums, { color: theme.text }]}>
              {item.text}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

export function Dot({ colour }: { colour: string }) {
  return <View style={[styles.dot, { backgroundColor: colour }]} />;
}

function DashMark({ colour }: { colour: string }) {
  return (
    <Svg width={14} height={8} aria-hidden>
      <Line x1={0} x2={14} y1={4} y2={4} stroke={colour} strokeWidth={2} strokeDasharray="4 3" />
    </Svg>
  );
}

function Grid({ width, colour }: { width: number; colour: string }) {
  return (
    <>
      {[0, 0.5, 1].map((f) => (
        <Line
          key={f}
          x1={0}
          x2={width}
          y1={f * (PLOT - 1) + 0.5}
          y2={f * (PLOT - 1) + 0.5}
          stroke={colour}
          strokeWidth={1}
        />
      ))}
    </>
  );
}

function Ticks(props: { width: number; ticks: { left: number; label: string }[] }) {
  const { theme } = useTheme();
  const last = props.ticks.length - 1;
  return (
    <View style={styles.axis}>
      {props.ticks.map((tick, i) => (
        <Text
          key={`${tick.left}-${tick.label}`}
          style={[
            TYPE.footnote,
            styles.tick,
            styles.nums,
            { color: theme.textMuted, left: tick.left },
            last > 0 && i === 0 && styles.first,
            last > 0 && i === last && styles.last,
          ]}
          numberOfLines={1}
        >
          {tick.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACE.m,
    borderRadius: RADIUS.card,
    paddingTop: 14,
    paddingHorizontal: SPACE.l,
    paddingBottom: SPACE.m,
  },
  top: {
    minHeight: 18,
    marginBottom: SPACE.m,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.s,
  },
  plot: { height: PLOT },
  items: { flexDirection: "row", gap: SPACE.m },
  key: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  strong: { fontWeight: "600" },
  legend: { marginTop: SPACE.s, flexDirection: "row", alignItems: "center", gap: 14 },
  grow: { flex: 1 },
  axis: { height: 19, marginTop: SPACE.s },
  /** Centred on its point; the first and last sit flush with the graph's ends. */
  tick: { position: "absolute", top: 0, width: 72, marginLeft: -36, textAlign: "center" },
  first: { marginLeft: -EDGE, textAlign: "left" },
  last: { marginLeft: -72 + EDGE, textAlign: "right" },
  nums: { fontVariant: ["tabular-nums"] },
});
