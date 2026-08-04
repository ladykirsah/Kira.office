import type { Granularity } from "@l-shopee/core";
import { formatBahtTrim } from "./format";

/**
 * The arithmetic behind the Insight page's chart and tiles.
 *
 * Pure and separate from the components for the usual reason, and one specific one: an SVG that
 * receives a single `NaN` anywhere in a path string renders nothing at all — silently, with no
 * console error and no broken layout to notice. Every edge that could produce one (an empty series,
 * a flat-zero day, a one-point month) is therefore a test up front rather than a bug report from a
 * shop wondering where its chart went.
 */

export type MetricFormat = "money" | "count" | "percent";

/** One tile's value as the owner reads it. */
export function formatMetric(value: number, format: MetricFormat): string {
  if (format === "money") return formatBahtTrim(value);
  if (format === "percent") return `${value.toFixed(2)}%`;
  return Math.round(value).toLocaleString("en-US");
}

export interface Delta {
  text: string;
  tone: "up" | "down" | "flat";
}

/**
 * The comparison line under a tile — Shopee's "▼64.00%".
 *
 * Note what this deliberately does NOT do: colour the arrow green or red. Down is not automatically
 * bad (a fall in refunds is a good day) and the page has no idea which metric it is labelling, so it
 * reports direction and leaves judgement to the person reading it. The tone is for the caller to map
 * to whatever colour that particular metric deserves.
 */
export function deltaLabel(pct: number | null): Delta {
  if (pct == null) return { text: "—", tone: "flat" };
  if (pct === 0) return { text: "0.00%", tone: "flat" };
  const arrow = pct > 0 ? "▲" : "▼";
  return { text: `${arrow}${Math.abs(pct).toFixed(2)}%`, tone: pct > 0 ? "up" : "down" };
}

/**
 * The chart's y-axis ceiling: a round number at or above the largest value, never zero.
 *
 * The floor of 1 is the important part — a day with no sales yet is the common case for a shop that
 * has just opened, and dividing by a zero maximum would put `NaN` into every coordinate.
 */
export function niceMax(values: readonly number[]): number {
  const peak = values.length ? Math.max(...values) : 0;
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / magnitude) * magnitude;
}

export interface ChartPoint {
  x: number;
  y: number;
}

/** Straight segments between points, or the owner's chosen smooth curve (design 5, 4 Aug 2026). */
export type Curve = "linear" | "smooth";

/**
 * A smooth curve through the points that never leaves the range of the points it joins —
 * monotone cubic interpolation (Fritsch–Carlson).
 *
 * The obvious smoothing, Catmull-Rom, overshoots: given an empty hour, a sale, then another empty
 * hour, it swings the curve past both ends and dips below the baseline. On this page that is drawn
 * as negative sales, and AirPlus's real days are exactly that shape — two orders and twenty-two
 * quiet hours. Clamping the tangent to zero at every local peak or trough pins the curve to its
 * points, so the picture stays as smooth as the owner asked for while never claiming a value that
 * did not happen.
 */
function monotonePath(points: readonly ChartPoint[]): string {
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const run = points[i + 1]!.x - points[i]!.x;
    dx.push(run);
    slope.push(run === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / run);
  }

  const m: number[] = [slope[0] ?? 0];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    // Opposite signs (or a flat) means this point is a turning point — a zero tangent there is what
    // removes the overshoot.
    m.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  m.push(slope[n - 2] ?? 0);

  // A flat segment must stay perfectly flat at both ends, or a long quiet stretch ripples.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    }
  }

  let d = `M${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    d +=
      ` C${p1.x + h / 3} ${p1.y + (m[i]! * h) / 3},` +
      `${p2.x - h / 3} ${p2.y - (m[i + 1]! * h) / 3},` +
      `${p2.x} ${p2.y}`;
  }
  return d;
}

export interface ChartGeometry {
  points: ChartPoint[];
  /** `M…L…` through every point — the line itself. */
  line: string;
  /** The same path closed along the baseline, for the soft fill under it. */
  area: string;
}

/**
 * Map a series onto an SVG box. Y is inverted (0 is the top), so the largest value lands at y=0.
 *
 * A single-point series is centred rather than divided by `length - 1`, which would be a division by
 * zero — that is the month-to-date chart on the 1st of the month, so it is a real case, not a
 * theoretical one.
 */
export function chartGeometry(
  values: readonly number[],
  max: number,
  box: { width: number; height: number },
  curve: Curve = "linear",
): ChartGeometry {
  if (values.length === 0) return { points: [], line: "", area: "" };

  const span = values.length - 1;
  const points = values.map((v, i) => ({
    x: span === 0 ? box.width / 2 : (i / span) * box.width,
    y: box.height - (Math.max(0, v) / max) * box.height,
  }));

  const line =
    curve === "smooth" && points.length > 1
      ? monotonePath(points)
      : points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${line} L${last.x} ${box.height} L${first.x} ${box.height} Z` : "";

  return { points, line, area };
}

export interface AxisTick {
  /** 0-1 across the chart's width, so the caller places it without knowing the geometry. */
  position: number;
  label: string;
}

/**
 * Sparse x-axis labels: every sixth hour, or the two ends of a multi-day range.
 *
 * Shopee prints four times on a 24-hour axis (00:00 · 06:00 · 12:00 · 18:00) rather than twenty-four,
 * and they are right — a phone is about 360px wide and 24 labels become a grey smear. Bangkok time
 * throughout, read via the UTC getters on a shifted instant so the admin shows the same hour whether
 * it is opened in the shop or from abroad.
 */
export function axisTicks(buckets: readonly number[], granularity: Granularity): AxisTick[] {
  if (buckets.length === 0) return [];
  const bkk = (ms: number) => new Date(ms + 7 * 60 * 60 * 1000);
  const span = Math.max(1, buckets.length - 1);

  if (granularity === "hour") {
    return buckets
      .map((ms, i) => ({ ms, i }))
      .filter(({ i }) => i % 6 === 0)
      .map(({ ms, i }) => ({
        position: i / span,
        label: `${String(bkk(ms).getUTCHours()).padStart(2, "0")}:00`,
      }));
  }

  const label = (ms: number) => `${bkk(ms).getUTCDate()}/${bkk(ms).getUTCMonth() + 1}`;
  const firstMs = buckets[0]!;
  const lastMs = buckets[buckets.length - 1]!;
  if (buckets.length === 1) return [{ position: 0.5, label: label(firstMs) }];
  return [
    { position: 0, label: label(firstMs) },
    { position: 1, label: label(lastMs) },
  ];
}

/**
 * The y-scale each plotted series should use: shared when they are the same kind of number,
 * independent when they are not.
 *
 * This is the difference between a chart that informs and one that lies. The default pair on the
 * page is sales and profit — both baht. Scaled independently, ฿1,350 of sales and ฿420 of profit
 * each touch the top of the box and the picture claims the shop kept everything it took. Scaled
 * together, the gap between the two lines IS the cost, which is the single most useful thing that
 * chart can show.
 *
 * The opposite is just as true for mixed units: baht against a headcount have no common axis, and
 * forcing one would press the visitors line flat onto the baseline. So the rule is by FORMAT, not a
 * preference — same unit, same scale; different units, their own.
 */
export function seriesScales(
  series: readonly { format: MetricFormat; values: readonly number[] }[],
): number[] {
  if (series.length === 0) return [];
  const sameUnit = series.every((s) => s.format === series[0]!.format);
  if (sameUnit) {
    const shared = niceMax(series.flatMap((s) => [...s.values]));
    return series.map(() => shared);
  }
  return series.map((s) => niceMax(s.values));
}
