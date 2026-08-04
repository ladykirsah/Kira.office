"use client";

import { useState } from "react";
import {
  METRICS,
  PRIORITY_METRIC_KEYS,
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

/** Sales and profit lead, at double size — the owner's twin heroes (4 Aug 2026). */
const HERO_KEYS: readonly MetricKey[] = ["sales", "profit"];
const MAX_SERIES = 2;

/** The two lines' colours. Coral is the primary series; slate is the overlay. */
const SERIES_COLORS = ["var(--primary)", "#2563eb"];

const SOURCE_LABELS: Record<string, string> = {
  direct: "เข้าตรง",
  search: "การค้นหา",
  social: "โซเชียล",
  ai: "ผู้ช่วย AI",
  referral: "เว็บอื่น",
  internal: "ภายในเว็บ",
};

const CHART_BOX = { width: 720, height: 170 };

export function InsightBoard({ payload }: { payload: InsightsPayload }) {
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

  const heroes = METRICS.filter((m) => HERO_KEYS.includes(m.key));
  // The owner's six lead (4 Aug 2026), minus sales — it is already the hero directly above, and
  // printing the same number twice on one screen makes a reader hunt for the difference.
  const priority = PRIORITY_METRIC_KEYS.filter((k) => !HERO_KEYS.includes(k)).map((k) =>
    METRICS.find((m) => m.key === k)!,
  );
  // Everything else, still shown rather than hidden — the owner asked to keep all fourteen in view.
  const isPriority = (k: MetricKey) =>
    (PRIORITY_METRIC_KEYS as readonly MetricKey[]).includes(k) || HERO_KEYS.includes(k);
  const moneyRest = METRICS.filter((m) => m.group === "money" && !isPriority(m.key));
  const traffic = METRICS.filter((m) => m.group === "traffic" && !isPriority(m.key));

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
      {/* Twin heroes. Same size as each other on purpose: neither sales nor profit outranks the
          other, which is the whole point of showing both. */}
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

      <Chart
        selected={selected}
        perBucket={perBucket}
        ticks={ticks}
        buckets={payload.series.buckets}
      />

      <TileGroup title="ตัวชี้วัดหลัก">
        {priority.map((def) => (
          <MetricTile key={def.key} {...tileProps(def)} />
        ))}
      </TileGroup>

      <TileGroup title="ยอดขาย">
        {moneyRest.map((def) => (
          <MetricTile key={def.key} {...tileProps(def)} />
        ))}
      </TileGroup>

      <TileGroup
        title="การเข้าชม"
        note={
          // Stated on the page, not buried in a migration: a metric the reader cannot audit is worse
          // than one they can discount.
          granularity === "day"
            ? "ผู้เข้าชมในช่วงหลายวันนับแบบรายวันรวมกัน — คนเดิมที่กลับมาอีกวันจะถูกนับใหม่"
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
        background: selected ? "var(--primary-faint)" : "var(--surface)",
        border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
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
  // Two money metrics share one scale so the gap between the lines is the real gap (sales vs profit
  // is the default pair, and independent scales made profit look equal to revenue). Mixed units keep
  // their own — see seriesScales.
  const plotted = selected.map((key) => ({
    key,
    format: METRICS.find((m) => m.key === key)?.format ?? "count",
    values: perBucket.map((b) => b[key]),
  }));
  const scales = seriesScales(plotted);
  const series = plotted.map((s, i) => ({
    key: s.key,
    geo: chartGeometry(s.values, scales[i] ?? 1, CHART_BOX),
    color: SERIES_COLORS[i] ?? SERIES_COLORS[0]!,
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
        preserveAspectRatio="none"
        role="img"
        aria-label={`แนวโน้ม ${selected.join(", ")}`}
        style={{ width: "100%", height: 170, display: "block", overflow: "visible" }}
      >
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
            {i === 0 && s.geo.area && <path d={s.geo.area} fill={s.color} opacity={0.08} />}
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
        {ticks.map((t) => (
          <span
            key={t.label}
            style={{
              position: "absolute",
              left: `${t.position * 100}%`,
              transform:
                t.position === 0
                  ? "none"
                  : t.position === 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </span>
        ))}
        {buckets.length === 0 && <span>ไม่มีข้อมูล</span>}
      </div>
    </div>
  );
}

function SourceTable({ rows }: { rows: InsightSourceRow[] }) {
  const totalVisitors = rows.reduce((n, r) => n + r.visitors, 0);
  return (
    <section>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>ที่มาของการเข้าชม</h2>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
        {/* Shopee shows sales per source; we cannot, and say so rather than inventing a number.
            Attributing a sale to a source needs the browsing session to be linked to the order,
            which is exactly the link the visitor-id design refuses to make. */}
        นับเฉพาะการเข้าชม — ยังไม่แยกยอดขายตามที่มา · 1 การมองเห็น = 1 คลิก
      </p>
      <TableFrame>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>ที่มา</th>
              <th style={{ textAlign: "right" }}>สัดส่วน</th>
              <th style={{ textAlign: "right" }}>ผู้เข้าชม</th>
              <th style={{ textAlign: "right" }}>มองเห็นสินค้า</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  ยังไม่มีข้อมูลการเข้าชมในช่วงนี้
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.source}>
                <td>{SOURCE_LABELS[r.source] ?? r.source}</td>
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
  return (
    <section>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>สินค้าขายดี</h2>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
        เรียงตามยอดขาย — สินค้าที่มีคนดูแต่ยังไม่มีใครซื้อจะอยู่ท้ายตาราง
      </p>
      <TableFrame>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", width: 44 }}>อันดับ</th>
              <th style={{ textAlign: "left" }}>สินค้า</th>
              <th style={{ textAlign: "right" }}>ยอดขาย</th>
              <th style={{ textAlign: "right" }}>กำไร</th>
              <th style={{ textAlign: "right" }}>ขายได้</th>
              <th style={{ textAlign: "right" }}>มองเห็น</th>
              <th style={{ textAlign: "right" }}>อัตราการซื้อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  ยังไม่มีข้อมูลสินค้าในช่วงนี้
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
