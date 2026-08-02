"use client";

import { useEffect, useState } from "react";
import { fetchSales, fetchOrders, type SaleRow, type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import {
  rangeFor,
  summarize,
  totalChannelSales,
  toDateInputValue,
  salesView,
  ordersView,
  growthRatePct,
  type RangePreset,
  type ChannelSales,
} from "@/lib/salesSummary";
import { airplusStatusBadge } from "@/lib/badges";
import { PageHeader } from "../PageHeader";
import { SalesTable } from "./SalesTable";
import { AirPlusOrders } from "./AirPlusOrders";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "thisWeek", label: "This week" },
  { key: "lastWeek", label: "Last week" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];

const card = {
  // Grow to share the row's full width equally; minWidth 150 keeps them from getting too narrow
  // (they wrap to the next line instead), so a row of cards fills the page rather than sitting small.
  flex: 1,
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
  background: "var(--surface)",
} as const;

const right = { textAlign: "right" } as const;

type SalesTab = "summary" | "onsite" | "airplus";

const DAY_MS = 24 * 60 * 60 * 1000;

/** An order's effective sale date: when it was placed, falling back to when it was imported. */
const orderDate = (o: OrderRow) => o.orderCreatedAt ?? o.importedAt;

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [tab, setTab] = useState<SalesTab>("summary");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    fetchSales()
      .then(setSales)
      .catch((err) => setError((err as Error).message));
    fetchOrders()
      .then(setOrders)
      .catch((err) => setError((err as Error).message));
  }, []);

  // Filters are per-tab; reset search/status/type on tab switch (the period persists).
  useEffect(() => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
  }, [tab]);

  if (error) {
    return (
      <main>
        <h1>Finance</h1>
        <p style={{ color: "var(--danger)" }}>Could not load sales: {error}</p>
      </main>
    );
  }

  const range = rangeFor(preset, Date.now(), { start: customStart, end: customEnd });
  // Date inputs always reflect the effective range (endMs is exclusive, so show the last included
  // day); editing one switches to a custom range, seeding the other end if it was empty.
  const fromDisplay = toDateInputValue(range.startMs);
  const toDisplay = toDateInputValue(range.endMs - DAY_MS);
  const editFrom = (v: string) => {
    setCustomStart(v);
    setCustomEnd(customEnd || toDisplay);
    setPreset("custom");
  };
  const editTo = (v: string) => {
    setCustomEnd(v);
    setCustomStart(customStart || fromDisplay);
    setPreset("custom");
  };

  const inRange = (sales ?? []).filter(
    (s) => s.createdAt >= range.startMs && s.createdAt < range.endMs,
  );
  const s = summarize(inRange, range);

  // Onsite table/info/CSV view: period → search + status filter/sort. Feeds the cards + table.
  const onsiteView = salesView(inRange, { search, status: statusFilter, type: typeFilter });
  const onsiteSumm = summarize(onsiteView, range);
  const onsiteStatuses = Array.from(new Set(inRange.map((x) => x.saleStatus))).sort();

  // Growth rate: this period's revenue vs the previous equal-length period (same search/filter).
  const prevRange = {
    startMs: range.startMs - (range.endMs - range.startMs),
    endMs: range.startMs,
  };
  const prevView = salesView(
    (sales ?? []).filter((x) => x.createdAt >= prevRange.startMs && x.createdAt < prevRange.endMs),
    { search, status: statusFilter, type: typeFilter },
  );
  const onsiteGrowth = growthRatePct(
    onsiteSumm.revenueSatang,
    summarize(prevView, prevRange).revenueSatang,
  );
  // Format any growth %: no "+"; negatives shown accounting-style, e.g. -5% → "(5%)".
  const fmtGrowth = (pct: number | null) =>
    pct === null
      ? "—"
      : Math.round(pct) < 0
        ? `(${Math.abs(Math.round(pct))}%)`
        : `${Math.round(pct)}%`;

  // AirPlus tab (own single-seller site: no commission, Sales = payout, real profit).
  const airplusInRange = (orders ?? []).filter(
    (o) => o.channel === "airplus" && orderDate(o) >= range.startMs && orderDate(o) < range.endMs,
  );
  const airplusRangeSales = airplusInRange.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0);
  const airplusStatuses = Array.from(
    new Set(airplusInRange.map((o) => airplusStatusBadge(o.orderStatus).label)),
  ).sort();
  const airplusView = ordersView(airplusInRange, { search, status: "" }).filter(
    (o) => statusFilter === "" || airplusStatusBadge(o.orderStatus).label === statusFilter,
  );
  const airplusSales = airplusView.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0);
  const airplusProfit = airplusView.reduce((sum, o) => sum + (o.profitSatang ?? 0), 0);
  // AirPlus growth: this period's revenue vs the previous equal-length period, same filter.
  const airplusPrevInRange = (orders ?? []).filter(
    (o) =>
      o.channel === "airplus" &&
      orderDate(o) >= prevRange.startMs &&
      orderDate(o) < prevRange.endMs,
  );
  const airplusPrevView = ordersView(airplusPrevInRange, { search, status: "" }).filter(
    (o) => statusFilter === "" || airplusStatusBadge(o.orderStatus).label === statusFilter,
  );
  const airplusGrowth = growthRatePct(
    airplusSales,
    airplusPrevView.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0),
  );

  // Group 1 — product sales across channels (roll-up shown in the summary table).
  const channelRows: ChannelSales[] = [
    {
      key: "onsite",
      label: "Den Air Service",
      count: s.salesCount,
      revenueSatang: s.revenueSatang,
    },
    {
      key: "airplus",
      label: "AirPlus",
      count: airplusInRange.length,
      revenueSatang: airplusRangeSales,
    },
  ];
  const channelTotal = totalChannelSales(channelRows);

  // Summary combines both shops (no per-shop filter here). Profit = onsite gross profit + AirPlus
  // profit; growth = combined revenue vs the previous equal-length period.
  const airplusRangeProfit = airplusInRange.reduce((sum, o) => sum + (o.profitSatang ?? 0), 0);
  const summaryProfit = s.grossProfitSatang + airplusRangeProfit;
  const onsitePrevRevenue = summarize(
    (sales ?? []).filter((x) => x.createdAt >= prevRange.startMs && x.createdAt < prevRange.endMs),
    prevRange,
  ).revenueSatang;
  const airplusPrevRevenue = airplusPrevInRange.reduce((sum, o) => sum + (o.salesSatang ?? 0), 0);
  const summaryGrowth = growthRatePct(
    channelTotal.revenueSatang,
    onsitePrevRevenue + airplusPrevRevenue,
  );

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div style={card}>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );

  const TabBtn = ({ id, label }: { id: SalesTab; label: string }) => (
    <button className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  const cardsRow = { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 } as const;
  const frameStyle = {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 18,
    background: "var(--surface)",
  } as const;
  const toolbarStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  } as const;

  // The framed toolbar shared by every tab: optional search + status + type, always a date range.
  // A plain function (not a component) so its inputs keep focus while typing.
  const toolbar = (opts: {
    searchPlaceholder?: string;
    statuses?: string[];
    showType?: boolean;
  }) => (
    <>
      <div style={toolbarStyle}>
        {opts.searchPlaceholder && (
          <input
            className="tbar-input"
            placeholder={opts.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputS, width: 240, maxWidth: "100%", color: "var(--text)" }}
          />
        )}
        {opts.statuses && (
          <select
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...inputS, color: statusFilter ? "var(--text)" : "var(--text-faint)" }}
          >
            <option value="">All status</option>
            {opts.statuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        )}
        {opts.showType && (
          <select
            aria-label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ ...inputS, color: typeFilter ? "var(--text)" : "var(--text-faint)" }}
          >
            <option value="">All types</option>
            <option value="parts">Products</option>
            <option value="repair">Service</option>
          </select>
        )}
        <select
          aria-label="Date range"
          value={preset}
          onChange={(e) => setPreset(e.target.value as RangePreset)}
          style={inputS}
        >
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {preset === "custom" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <input
            type="date"
            value={fromDisplay}
            onChange={(e) => editFrom(e.target.value)}
            aria-label="From date"
            style={inputS}
          />
          <span className="muted">–</span>
          <input
            type="date"
            value={toDisplay}
            onChange={(e) => editTo(e.target.value)}
            aria-label="To date"
            style={inputS}
          />
        </div>
      )}
    </>
  );

  return (
    <main>
      <PageHeader title="Finance" subtitle="Product sales by channel." />

      <div className="tabs">
        <TabBtn id="summary" label={`Summary (${channelTotal.count})`} />
        <TabBtn id="onsite" label={`Den Air Service (${s.salesCount})`} />
        <TabBtn id="airplus" label={`AirPlus (${airplusInRange.length})`} />
      </div>

      {sales === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          {tab === "summary" && (
            <>
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(channelTotal.revenueSatang)} />
                <Card label="Conversions" value={String(channelTotal.count)} />
                <Card label="Profit" value={formatBahtTrim(summaryProfit)} />
                <Card label="Growth rate" value={fmtGrowth(summaryGrowth)} />
              </div>
              <div style={frameStyle}>
                {toolbar({})}
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th style={right}>Conversions</th>
                        <th style={right}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelRows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.label}</td>
                          <td style={right}>{r.count}</td>
                          <td style={right}>{formatBahtTrim(r.revenueSatang)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
                        <td>Total</td>
                        <td style={right}>{channelTotal.count}</td>
                        <td style={right}>{formatBahtTrim(channelTotal.revenueSatang)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === "onsite" && (
            <>
              {/* Cards reflect the filtered view */}
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(onsiteSumm.revenueSatang)} />
                <Card label="Conversions" value={String(onsiteSumm.salesCount)} />
                <Card label="Profit" value={formatBahtTrim(onsiteSumm.grossProfitSatang)} />
                <Card label="Growth rate" value={fmtGrowth(onsiteGrowth)} />
              </div>
              <div style={frameStyle}>
                {toolbar({
                  searchPlaceholder: "Search plate / car / bill / amount…",
                  statuses: onsiteStatuses,
                  showType: true,
                })}
                <SalesTable sales={onsiteView} />
              </div>
            </>
          )}

          {tab === "airplus" && (
            <>
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(airplusSales)} />
                <Card label="Conversions" value={String(airplusView.length)} />
                <Card label="Profit" value={formatBahtTrim(airplusProfit)} />
                <Card label="Growth rate" value={fmtGrowth(airplusGrowth)} />
              </div>
              <div style={frameStyle}>
                {toolbar({
                  searchPlaceholder: "Search order / status / amount…",
                  statuses: airplusStatuses,
                })}
                <AirPlusOrders
                  orders={airplusView}
                  onChanged={() =>
                    fetchOrders()
                      .then(setOrders)
                      .catch((err) => setError((err as Error).message))
                  }
                />
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
