import type { Granularity, InsightPeriod } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared";
import { MONTHS_EN, MONTHS_TH } from "./customerPage";

/**
 * The arithmetic behind ภาพรวม AirPlus's graph (owner approved the drawing, canvas v233, 1 Nov
 * 2026). The scale, the curve and the shared-scale rule are the web back office's
 * (apps/admin/src/lib/insightChart.ts, the owner's design 5 of 4 Aug 2026); the axis and the tap
 * words follow the new drawing. Pure: one NaN in a path blanks the whole graph without an error,
 * so every edge is a test here instead.
 */

export type MetricFormat = "money" | "count" | "percent";

export interface ChartPoint {
  x: number;
  y: number;
}

/** Straight segments, or the owner's smooth curve. */
export type Curve = "linear" | "smooth";

export interface ChartGeometry {
  points: ChartPoint[];
  /** The line itself. */
  line: string;
  /** The same path closed along the bottom, for the soft fill under it. */
  area: string;
}

export interface AxisTick {
  /** 0–1 across the graph's width. */
  position: number;
  label: Phrase;
}

const HOUR_MS = 3_600_000;
/** Bucket starts are Bangkok times; read them through UTC getters on a shifted instant. */
const BANGKOK_MS = 7 * HOUR_MS;
const bangkok = (ms: number) => new Date(ms + BANGKOK_MS);
const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
/** Hour labels every six hours, as Shopee's 00:00 · 06:00 · 12:00 · 18:00. */
const HOUR_STEP = 6;
/** A last-hour label closer than this to the one before would overlap it. */
const MIN_LABEL_GAP = 2;
/** Day axes carry four labels: the ends and two between. */
const DAY_LABELS = 4;

/** The y ceiling: a round number at or above the largest value, never 0 (no dividing by zero). */
export function niceMax(values: readonly number[]): number {
  const peak = values.length ? Math.max(...values) : 0;
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / magnitude) * magnitude;
}

/**
 * A smooth curve that never leaves the range of the points it joins (monotone cubic,
 * Fritsch–Carlson), so an empty hour, a sale and an empty hour never dip below zero.
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
    // A turning point gets a flat tangent: that is what stops the overshoot.
    m.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  m.push(slope[n - 2] ?? 0);
  // A flat stretch stays flat at both ends, or a quiet day ripples.
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

/** A series on a box, y upside down (0 is the top). One point sits in the middle. */
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
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return { points, line, area: `${line} L${last.x} ${box.height} L${first.x} ${box.height} Z` };
}

/**
 * Each line's y ceiling: one shared scale when the lines are the same kind of number (sales and
 * profit — the gap between them is the cost), their own when they are not (baht and a headcount).
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

/**
 * How many buckets the graph draws. วันนี้ stops at the hour we are in, as drawn (00:00 … 14:00);
 * every other period is whole.
 */
export function shownBuckets(
  period: InsightPeriod,
  buckets: readonly number[],
  now: number,
): number {
  if (period !== "realtime" || buckets.length === 0) return buckets.length;
  const elapsed = Math.floor((now - buckets[0]!) / HOUR_MS) + 1;
  return Math.min(buckets.length, Math.max(1, elapsed));
}

function dayMonth(ms: number): Phrase {
  const d = bangkok(ms);
  return {
    th: `${d.getUTCDate()} ${MONTHS_TH[d.getUTCMonth()]}`,
    en: `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]}`,
  };
}

/**
 * The words under the graph. Hours: every sixth, and the last one drawn. Days: four, the month
 * named on the first and wherever a new month starts ("1 ต.ค. · 10 · 20 · 30").
 */
export function axisTicks(buckets: readonly number[], granularity: Granularity): AxisTick[] {
  if (buckets.length === 0) return [];
  const last = buckets.length - 1;
  if (last === 0) return [{ position: 0.5, label: dayMonth(buckets[0]!) }];

  if (granularity === "hour") {
    const at = buckets.map((_, i) => i).filter((i) => i % HOUR_STEP === 0);
    if (last - at[at.length - 1]! >= MIN_LABEL_GAP) at.push(last);
    return at.map((i) => {
      const label = hh(bangkok(buckets[i]!).getUTCHours());
      return { position: i / last, label: { th: label, en: label } };
    });
  }

  const at = [
    ...new Set(
      Array.from({ length: DAY_LABELS }, (_, k) =>
        k === DAY_LABELS - 1 ? last : Math.floor((k * last) / (DAY_LABELS - 1)),
      ),
    ),
  ];
  return at.map((i, k) => {
    const month = bangkok(buckets[i]!).getUTCMonth();
    const newMonth = k === 0 || bangkok(buckets[at[k - 1]!]!).getUTCMonth() !== month;
    const day = String(bangkok(buckets[i]!).getUTCDate());
    return { position: i / last, label: newMonth ? dayMonth(buckets[i]!) : { th: day, en: day } };
  });
}

/** What a tap on the graph reads: the hour's span ("11:00–12:00") or the day ("12 ต.ค."). */
export function bucketLabel(ms: number, granularity: Granularity): Phrase {
  if (granularity === "day") return dayMonth(ms);
  const hour = bangkok(ms).getUTCHours();
  const span = `${hh(hour)}–${hh(hour + 1)}`;
  return { th: span, en: span };
}

/** The point a tap at `x` lands on, across a graph `width` wide with `count` points. */
export function nearestBucket(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const i = Math.round((x / width) * (count - 1));
  return Math.min(count - 1, Math.max(0, i));
}
