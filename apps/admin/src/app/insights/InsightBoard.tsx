"use client";

import { useState } from "react";
import {
  METRICS,
  INSIGHT_LAYOUT,
  metricValues,
  pctChange,
  granularityFor,
  isInsightPeriod,
  type MetricKey,
  type MetricDef,
} from "@l-shopee/core";
import type { InsightsPayload, InsightProductRow, InsightSourceRow } from "@/lib/api";
import {
  axisTicks,
  chartGeometry,
  deltaLabel,
  formatMetric,
  seriesScales,
} from "@/lib/insightChart";
import { TableFrame } from "../TableFrame";
import { useT } from "../LangProvider";
import type { Phrase } from "@/lib/lang";

/**
 * The interactive half of AirPlus Insight.
 *
 * The one interaction worth copying from Shopee, on both their desktop and their phone app, is that
 * **the metric tiles ARE the chart's legend**: you tap ยอดขาย and the line becomes sales, you tap a
 * second and it overlays. It means the chart never needs its own control, and every number on the
 * page is one tap from being drawn over time. Everything else here is layout.
 *
 * Two series maximum, exactly as Shopee allows ("ตัวชี้วัดที่ถูกเลือก 2/4"), and never fewer than
 * one — a chart with nothing plotted is a hole in the page, so the last selected tile cannot be
 * switched off.
 */

const MAX_SERIES = 2;

/** The two lines' colours. Coral is the primary series; slate is the overlay. */
const SERIES_COLORS = ["var(--primary)", "#2563eb"];

const SOURCE_LABELS: Record<string, Phrase> = {
  direct: { th: "เข้าตรง", en: "Direct" },
  search: { th: "การค้นหา", en: "Search" },
  social: { th: "โซเชียล", en: "Social" },
  ai: { th: "ผู้ช่วย AI", en: "AI assistants" },
  referral: { th: "เว็บอื่น", en: "Other sites" },
  internal: { th: "ภายในเว็บ", en: "Within the site" },
};

const CHART_BOX = { width: 720, height: 170 };

export function InsightBoard({ payload }: { payload: InsightsPayload }) {
  const t = useT();
  const [selected, setSelected] = useState<MetricKey[]>(["sales", "profit"]);

  const current = metricValues(payload.totals);
  const previous = metricValues(payload.previous);
  const perBucket = payload.series.totals.map(metricValues);
  const granularity = granularityFor(isInsightPeriod(payload.period) ? payload.period : "realtime");
  const ticks = axisTicks(payload.series.buckets, granularity);

  function toggle(key: MetricKey) {
    setSelected((prev) => {
      if (prev.includes(key)) {
        // Never leave the chart empty — the last remaining series stays put.
        return prev.length === 1 ? prev : prev.filter((k) => k !== key);
      }
      // At the cap the oldest selection drops out, so a tap always visibly does something rather
      // than silently failing once two are on.
      return prev.length < MAX_SERIES ? [...prev, key] : [prev[1]!, key];
    });
  }

  // The page's shape lives in core, so this and its tests read one description of it. A key that
  // appears in both the strip and a group below renders twice from the SAME catalogue entry and the
  // same selection state, so the two copies can never disagree or drift apart.
  const defs = (keys: readonly MetricKey[]) => keys.map((k) => METRICS.find((m) => m.key === k)!);
  const heroes = defs(INSIGHT_LAYOUT.heroes);
  const strip = defs(INSIGHT_LAYOUT.strip);
  const moneyRest = defs(INSIGHT_LAYOUT.money);
  const traffic = defs(INSIGHT_LAYOUT.traffic);

  const tileProps = (def: MetricDef) => ({
    def,
    value: current[def.key],
    delta: pctChange(current[def.key], previous[def.key]),
    selected: selected.includes(def.key),
    seriesColor: SERIES_COLORS[selected.indexOf(def.key)],
    onSelect: () => toggle(def.key),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* The top block: two headline cards, then three supporting ones directly beneath with no
          heading. Held a card-gap apart rather than a section-gap so they read as one block while
          every tile keeps its own frame — the owner rejected a merged, hairline-divided panel here
          (4 Aug 2026), because everything else in this admin is a separate framed card. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {heroes.map((def) => (
            <MetricTile key={def.key} {...tileProps(def)} hero />
          ))}
        </div>
        {/* Exactly three columns: these are a fixed set, not a flowing grid, and auto-fill was
            opening a fourth slot on a wide screen and leaving dead space beside them. */}
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))",
          }}
        >
          {strip.map((def) => (
            <MetricTile key={def.key} {...tileProps(def)} />
          ))}
        </div>
      </div>

      <Chart
        selected={selected}
        perBucket={perBucket}
        ticks={ticks}
        buckets={payload.series.buckets}
      />

      <TileGroup title={t({ th: "ยอดขาย", en: "Sales" })}>
        {moneyRest.map((def) => (
          <MetricTile key={def.key} {...tileProps(def)} />
        ))}
      </TileGroup>

      <TileGroup
        title={t({ th: "การเข้าชม", en: "Visits" })}
        note={
          // Stated on the page, not buried in a migration: a metric the reader cannot audit is worse
          // than one they can discount.
          granularity === "day"
            ? t({
                th: "ผู้เข้าชมในช่วงหลายวันนับแบบรายวันรวมกัน — คนเดิมที่กลับมาอีกวันจะถูกนับใหม่",
                en: "Visitors over several days are counted per day and added up — the same person returning on another day is counted again.",
              })
            : undefined
        }
      >
        {traffic.map((def) => (
          <MetricTile key={def.key} {...tileProps(def)} />
        ))}
      </TileGroup>

      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        อัตราคำสั่งซื้อไม่สำเร็จ = ยกเลิก · หมดเวลาชำระ · เคลม · ส่งไม่สำเร็จ (นับคำสั่งซื้อละครั้ง)
        — {payload.totals.failedOrders} จาก {payload.totals.placedOrders} คำสั่งซื้อ
      </p>

      {payload.unknownCostOrders > 0 && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          กำไรไม่รวม {payload.unknownCostOrders} คำสั่งซื้อที่ยังไม่มีข้อมูลต้นทุน
        </p>
      )}

      <SourceTable rows={payload.sources} />
      <ProductTable rows={payload.products} />
    </div>
  );
}

function TileGroup({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>{title}</h2>
      {note && (
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
          {note}
        </p>
      )}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          marginTop: note ? 0 : 10,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function MetricTile({
  def,
  value,
  delta,
  selected,
  seriesColor,
  onSelect,
  hero,
}: {
  def: MetricDef;
  value: number;
  delta: number | null;
  selected: boolean;
  seriesColor?: string;
  onSelect: () => void;
  hero?: boolean;
}) {
  const d = deltaLabel(delta);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        textAlign: "left",
        // White throughout — the card's FRAME carries the meaning instead of a fill (owner,
        // 4 Aug 2026). A tile that is plotted wears its own line's colour as its border, so the
        // legend is the card itself: coral frame, coral line. No wash, so a blue-framed tile and a
        // coral-framed one sit side by side without either shouting.
        background: "var(--surface)",
        // Unplotted means no line to match, so the frame falls back to the ordinary hairline. This
        // also fixes an inconsistency the fill was hiding: a tile drawn in blue used to wear a coral
        // border, because the selected state was coloured by "is selected" rather than by which
        // series it actually is.
        border: `1px solid ${selected && seriesColor ? seriesColor : "var(--border)"}`,
        borderRadius: "var(--radius)",
        padding: hero ? "16px 18px" : "12px 14px",
        cursor: "pointer",
        font: "inherit",
        height: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {/* The dot ties the tile to its line in the chart above — the only legend either needs. */}
        {selected && seriesColor && (
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: seriesColor,
              flexShrink: 0,
            }}
          />
        )}
        {def.labelTh}
      </span>
      <span
        style={{
          fontSize: hero ? 28 : 20,
          fontWeight: 700,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatMetric(value, def.format)}
      </span>
      <span
        style={{
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: d.tone === "flat" ? "var(--text-faint)" : "var(--text-muted)",
        }}
      >
        {d.text}
      </span>
    </button>
  );
}

function Chart({
  selected,
  perBucket,
  ticks,
  buckets,
}: {
  selected: MetricKey[];
  perBucket: Record<MetricKey, number>[];
  ticks: { position: number; label: string }[];
  buckets: number[];
}) {
  const t = useT();
  // Two money metrics share one scale so the gap between the lines is the real gap (sales vs profit
  // is the default pair, and independent scales made profit look equal to revenue). Mixed units keep
  // their own — see seriesScales.
  const plotted = selected.map((key) => ({
    key,
    format: METRICS.find((m) => m.key === key)?.format ?? "count",
    values: perBucket.map((b) => b[key]),
  }));
  const scales = seriesScales(plotted);
  // Design 5, the owner's pick (4 Aug 2026): a smoothed curve with a gradient fade and a marked
  // endpoint. The smoothing is monotone, so the curve can never swing below the baseline between a
  // sale and an empty hour — see monotonePath. On this shop's real days that is not a corner case.
  const series = plotted.map((s, i) => ({
    key: s.key,
    geo: chartGeometry(s.values, scales[i] ?? 1, CHART_BOX, "smooth"),
    color: SERIES_COLORS[i] ?? SERIES_COLORS[0]!,
    last: s.values[s.values.length - 1] ?? 0,
    max: scales[i] ?? 1,
  }));

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px 14px 10px",
      }}
    >
      <svg
        viewBox={`0 0 ${CHART_BOX.width} ${CHART_BOX.height}`}
        role="img"
        aria-label={t({
          th: `แนวโน้ม ${selected.join(", ")}`,
          en: `Trend for ${selected.join(", ")}`,
        })}
        // height:auto with the viewBox intact — `preserveAspectRatio="none"` would squash the
        // endpoint circle into an ellipse at any width but exactly 720px.
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <defs>
          {/* The fill fades to nothing at the baseline, so the area reads as depth under the line
              rather than a solid block competing with the second series. */}
          <linearGradient id="insight-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Three faint gridlines. Enough to read a level against, quiet enough to ignore. */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={CHART_BOX.width}
            y1={f * CHART_BOX.height}
            y2={f * CHART_BOX.height}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.map((s, i) => (
          <g key={s.key}>
            {/* Only the primary series gets a fill; two overlapping washes read as mud. */}
            {i === 0 && s.geo.area && <path d={s.geo.area} fill="url(#insight-fade)" />}
            {s.geo.line && (
              <path
                d={s.geo.line}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        ))}
        {/* "You are here" — the same endpoint mark Shopee puts on its real-time sparkline. */}
        {series[0] && series[0].geo.points.length > 0 && (
          <circle
            cx={CHART_BOX.width}
            cy={CHART_BOX.height - (Math.max(0, series[0].last) / series[0].max) * CHART_BOX.height}
            r={4}
            fill={series[0].color}
          />
        )}
      </svg>

      <div
        style={{
          position: "relative",
          height: 16,
          marginTop: 6,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        {ticks.map((tick) => (
          <span
            key={tick.label}
            style={{
              position: "absolute",
              left: `${tick.position * 100}%`,
              transform:
                tick.position === 0
                  ? "none"
                  : tick.position === 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {tick.label}
          </span>
        ))}
        {buckets.length === 0 && <span>{t({ th: "ไม่มีข้อมูล", en: "No data" })}</span>}
      </div>
    </div>
  );
}

function SourceTable({ rows }: { rows: InsightSourceRow[] }) {
  const t = useT();
  const totalVisitors = rows.reduce((n, r) => n + r.visitors, 0);
  return (
    <section>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>
        {t({ th: "ที่มาของการเข้าชม", en: "Where visits come from" })}
      </h2>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
        {/* Shopee shows sales per source; we cannot, and say so rather than inventing a number.
            Attributing a sale to a source needs the browsing session to be linked to the order,
            which is exactly the link the visitor-id design refuses to make. */}
        {t({
          th: "นับเฉพาะการเข้าชม — ยังไม่แยกยอดขายตามที่มา · 1 การมองเห็น = 1 คลิก",
          en: "Visits only — sales are not split by source yet · 1 product view = 1 click",
        })}
      </p>
      <TableFrame>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t({ th: "ที่มา", en: "Source" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "สัดส่วน", en: "Share" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "ผู้เข้าชม", en: "Visitors" })}</th>
              <th style={{ textAlign: "right" }}>
                {t({ th: "มองเห็นสินค้า", en: "Product views" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  {t({
                    th: "ยังไม่มีข้อมูลการเข้าชมในช่วงนี้",
                    en: "No visit data for this period yet.",
                  })}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.source}>
                <td>{SOURCE_LABELS[r.source] ? t(SOURCE_LABELS[r.source]) : r.source}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {totalVisitors === 0
                    ? "—"
                    : `${((r.visitors / totalVisitors) * 100).toFixed(1)}%`}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.visitors.toLocaleString("en-US")}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.productViews.toLocaleString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </section>
  );
}

/** 🥇🥈🥉 for the top three, then a plain number — Shopee's อันดับ column, and it reads instantly. */
const MEDALS = ["🥇", "🥈", "🥉"];

function ProductTable({ rows }: { rows: InsightProductRow[] }) {
  const t = useT();
  return (
    <section>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>
        {t({ th: "สินค้าขายดี", en: "Best sellers" })}
      </h2>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
        {t({
          th: "เรียงตามยอดขาย — สินค้าที่มีคนดูแต่ยังไม่มีใครซื้อจะอยู่ท้ายตาราง",
          en: "Ordered by sales — products people looked at but nobody bought sit at the bottom.",
        })}
      </p>
      <TableFrame>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", width: 44 }}>{t({ th: "อันดับ", en: "Rank" })}</th>
              <th style={{ textAlign: "left" }}>{t({ th: "สินค้า", en: "Product" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "ยอดขาย", en: "Sales" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "กำไร", en: "Profit" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "ขายได้", en: "Sold" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "มองเห็น", en: "Views" })}</th>
              <th style={{ textAlign: "right" }}>{t({ th: "อัตราการซื้อ", en: "Buy rate" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {t({
                    th: "ยังไม่มีข้อมูลสินค้าในช่วงนี้",
                    en: "No product data for this period yet.",
                  })}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.productId}>
                <td>{MEDALS[i] ?? i + 1}</td>
                <td>
                  <a href={`/products/${r.productId}`} style={{ color: "inherit" }}>
                    {r.name || "—"}
                  </a>
                  {r.productRef && (
                    <div className="muted" style={{ fontSize: 11 }}>
                      {r.productRef}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatMetric(r.salesSatang, "money")}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatMetric(r.profitSatang, "money")}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.units.toLocaleString("en-US")}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.views.toLocaleString("en-US")}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {/* Views, not clicks, is the denominator: the question this answers is "of the
                      people who reached the page, how many bought", which is what Shopee's
                      อัตราการซื้อสินค้า means. An em dash when nobody looked — 0% would imply we
                      showed it to people and they refused. */}
                  {r.views === 0 ? "—" : `${((r.units / r.views) * 100).toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </section>
  );
}
