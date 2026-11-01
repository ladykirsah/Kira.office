import { granularityFor, metricValues, type MetricKey } from "@l-shopee/core";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import {
  axisTicks,
  bucketLabel,
  chartGeometry,
  nearestBucket,
  seriesScales,
  shownBuckets,
} from "@/lib/insightChart";
import { formatOf, metricLabel, valueText, type InsightsPayload } from "@/lib/insightPage";
import { useLang, useTheme } from "../AppProviders";
import { RADIUS, SPACE, TYPE } from "../theme";
import { lineColour } from "./Tiles";

const PLOT_HEIGHT = 150;
const TIP_WIDTH = 156;
/** Room left and right so a line's end and its dot are not cut off. */
const EDGE = 4;

/**
 * Where across the graph a tap landed. A phone app gets it from the touch; in the browser the
 * press event carries no position of its own, so it is read from the click and the graph's box.
 */
function tapX(e: GestureResponderEvent): number {
  const native = e.nativeEvent as unknown as { locationX?: number; clientX?: number };
  const box = e.currentTarget as unknown as { getBoundingClientRect?: () => { left: number } };
  if (typeof native.clientX === "number" && typeof box?.getBoundingClientRect === "function") {
    return native.clientX - box.getBoundingClientRect().left;
  }
  return native.locationX ?? 0;
}

/**
 * The graph under the tiles (canvas v233): the picked tiles' lines over the period — วันนี้ up to
 * the hour we are in, by hour; 7 / 30 days and เดือนนี้ by day. Two baht lines share one scale, and
 * its top shows (฿4,000); baht against a headcount each keep their own, so no top number. A tap
 * reads that hour or day ("11:00–12:00 · ยอดขาย ฿3,450 · กำไร ฿1,050"); tapping it again closes it.
 */
export function TrendChart(props: { data: InsightsPayload; lines: readonly MetricKey[] }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [width, setWidth] = useState(0);
  const [tapped, setTapped] = useState<number | null>(null);

  const { period, series } = props.data;
  const count = shownBuckets(period, series.buckets, Date.now());
  const buckets = series.buckets.slice(0, count);
  const perBucket = series.totals.slice(0, count).map(metricValues);
  const granularity = granularityFor(period);
  const plotted = props.lines.map((key) => ({
    key,
    format: formatOf(key),
    values: perBucket.map((b) => b[key]),
  }));
  const scales = seriesScales(plotted);
  const shared = plotted.length > 0 && plotted.every((p) => p.format === plotted[0]!.format);
  const plotWidth = Math.max(0, width - EDGE * 2);
  const box = { width: plotWidth, height: PLOT_HEIGHT };
  const drawn = plotted.map((p, i) => ({
    ...p,
    geo: chartGeometry(p.values, scales[i] ?? 1, box, "smooth"),
    colour: lineColour(i, theme),
  }));
  const ticks = axisTicks(buckets, granularity);
  const at = tapped != null && tapped < count ? tapped : null;
  const tipX = at == null ? 0 : (drawn[0]?.geo.points[at]?.x ?? 0) + EDGE;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const tap = (x: number) => {
    const i = nearestBucket(x - EDGE, plotWidth, count);
    setTapped((now) => (now === i ? null : i));
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {shared && plotted[0] && (
        <Text style={[TYPE.footnote, styles.top, styles.nums, { color: theme.textMuted }]}>
          {valueText(plotted[0].key, scales[0] ?? 0)}
        </Text>
      )}
      <Pressable
        onLayout={onLayout}
        onPress={(e) => tap(tapX(e))}
        accessibilityRole="button"
        accessibilityLabel={t({
          th: `กราฟ ${props.lines.map((k) => t(metricLabel(k))).join(" และ ")} แตะเพื่อดูตัวเลข`,
          en: `Graph of ${props.lines.map((k) => t(metricLabel(k))).join(" and ")}, tap to read`,
        })}
        style={styles.plot}
      >
        {width > 0 && (
          <Svg width={width} height={PLOT_HEIGHT} aria-hidden>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={0}
                x2={width}
                y1={f * (PLOT_HEIGHT - 1) + 0.5}
                y2={f * (PLOT_HEIGHT - 1) + 0.5}
                stroke={theme.border}
                strokeWidth={1}
              />
            ))}
            {at != null && (
              <Line
                x1={tipX}
                x2={tipX}
                y1={0}
                y2={PLOT_HEIGHT}
                stroke={theme.textFaint}
                strokeWidth={1}
              />
            )}
            {drawn.map((d) => (
              <Path
                key={d.key}
                d={d.geo.line}
                transform={`translate(${EDGE} 0)`}
                stroke={d.colour}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {at != null &&
              drawn.map((d) => {
                const p = d.geo.points[at];
                return p ? (
                  <Circle
                    key={d.key}
                    cx={p.x + EDGE}
                    cy={p.y}
                    r={4}
                    fill={d.colour}
                    stroke={theme.surface}
                    strokeWidth={2}
                  />
                ) : null;
              })}
          </Svg>
        )}
        {at != null && buckets[at] != null && (
          <View
            pointerEvents="none"
            style={[
              styles.tip,
              {
                backgroundColor: theme.graphite,
                left: Math.min(Math.max(0, tipX - TIP_WIDTH / 2), Math.max(0, width - TIP_WIDTH)),
              },
            ]}
          >
            <Text style={[TYPE.footnote, styles.tipText]}>
              {t(bucketLabel(buckets[at], granularity))}
            </Text>
            {plotted.map((p) => (
              <Text key={p.key} style={[TYPE.footnote, styles.tipText, styles.nums]}>
                {t(metricLabel(p.key))} {valueText(p.key, p.values[at] ?? 0)}
              </Text>
            ))}
          </View>
        )}
      </Pressable>
      <View style={styles.axis}>
        {ticks.map((tick, i) => (
          <Text
            key={`${tick.position}-${t(tick.label)}`}
            style={[
              TYPE.footnote,
              styles.tick,
              styles.nums,
              { color: theme.textMuted, left: tick.position * plotWidth + EDGE },
              ticks.length > 1 && i === 0 && styles.first,
              ticks.length > 1 && i === ticks.length - 1 && styles.last,
            ]}
            numberOfLines={1}
          >
            {t(tick.label)}
          </Text>
        ))}
      </View>
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
  top: { alignSelf: "flex-end", marginBottom: SPACE.xs },
  plot: { height: PLOT_HEIGHT },
  tip: {
    position: "absolute",
    top: 0,
    width: TIP_WIDTH,
    borderRadius: 10,
    paddingVertical: SPACE.s,
    paddingHorizontal: SPACE.m,
  },
  tipText: { color: "#FFFFFF" },
  axis: { height: 19, marginTop: SPACE.s },
  /** Centred on its point; the first and last sit flush with the graph's ends. */
  tick: { position: "absolute", top: 0, width: 64, marginLeft: -32, textAlign: "center" },
  first: { marginLeft: -EDGE, textAlign: "left" },
  last: { marginLeft: -64, textAlign: "right" },
  nums: { fontVariant: ["tabular-nums"] },
});
