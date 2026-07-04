"use client";

import { useEffect, useState } from "react";
import { apiBase, fetchSales, fetchOrders, type SaleRow, type OrderRow } from "@/lib/api";
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
import { onsiteSalesToCsv, onlineOrdersToCsv } from "@/lib/salesCsv";
import { shopeeStatusBadge, airplusStatusBadge } from "@/lib/badges";
import { PageHeader } from "../PageHeader";
import { SalesTable } from "./SalesTable";
import { OnlineOrders } from "./OnlineOrders";
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
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
  background: "var(--surface)",
} as const;

const right = { textAlign: "right" } as const;

type SalesTab = "summary" | "onsite" | "shopee" | "airplus";

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
      .catch(() => setOrders([]));
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
        <h1>Sales</h1>
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
  // No "+"; negatives shown accounting-style, e.g. -5% → "(5%)".
  const growthLabel =
    onsiteGrowth === null
      ? "—"
      : Math.round(onsiteGrowth) < 0
        ? `(${Math.abs(Math.round(onsiteGrowth))}%)`
        : `${Math.round(onsiteGrowth)}%`;

  const shopeeInRange = (orders ?? []).filter(
    (o) => o.channel === "shopee" && orderDate(o) >= range.startMs && orderDate(o) < range.endMs,
  );
  const shopeeTotal = shopeeInRange.reduce((sum, o) => sum + o.grandTotalSatang, 0);
  const shopeeFees = shopeeInRange.reduce((sum, o) => sum + (o.feeTotalSatang ?? 0), 0);
  // Shopee tab view: search + order-status filter over the period (cards + table reflect it).
  // Status filters on the short mapped label (Complete/Shipped/…), not the verbose raw status.
  const shopeeStatuses = Array.from(
    new Set(shopeeInRange.map((o) => shopeeStatusBadge(o.orderStatus).label)),
  ).sort();
  const shopeeView = ordersView(shopeeInRange, { search, status: "" }).filter(
    (o) => statusFilter === "" || shopeeStatusBadge(o.orderStatus).label === statusFilter,
  );
  const shopeeViewTotal = shopeeView.reduce((sum, o) => sum + o.grandTotalSatang, 0);
  const shopeeViewFees = shopeeView.reduce((sum, o) => sum + (o.feeTotalSatang ?? 0), 0);
  // Profit is only known once order lines are matched to Kira costs — "—" until then.
  const shopeeHasProfit = shopeeView.some((o) => o.profitSatang != null);
  const shopeeViewProfit = shopeeView.reduce((sum, o) => sum + (o.profitSatang ?? 0), 0);

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

  // Group 1 — product sales across channels (roll-up shown in the summary table).
  const channelRows: ChannelSales[] = [
    { key: "onsite", label: "Onsite", count: s.salesCount, revenueSatang: s.revenueSatang },
    { key: "shopee", label: "Shopee", count: shopeeInRange.length, revenueSatang: shopeeTotal },
    {
      key: "airplus",
      label: "AirPlus",
      count: airplusInRange.length,
      revenueSatang: airplusRangeSales,
    },
  ];
  const channelTotal = totalChannelSales(channelRows);

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

  const download = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const csvLink = (onClick: () => void) => (
    <div style={{ marginBottom: 14 }}>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
      >
        Download CSV
      </a>
    </div>
  );

  return (
    <main>
      <PageHeader title="Sales" subtitle="Product sales by channel." />

      <div className="tabs">
        <TabBtn id="summary" label={`Summary (${channelTotal.count})`} />
        <TabBtn id="onsite" label={`Onsite (${s.salesCount})`} />
        <TabBtn id="shopee" label={`Shopee (${shopeeInRange.length})`} />
        <TabBtn id="airplus" label={`AirPlus (${airplusInRange.length})`} />
      </div>

      {sales === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          {tab === "summary" && (
            <>
              <div style={cardsRow}>
                <Card label="Total revenue" value={formatBahtTrim(channelTotal.revenueSatang)} />
                <Card label="Total sales" value={String(channelTotal.count)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <a href={`${apiBase}/sales/export.csv`}>Download CSV</a>
              </div>
              <div style={frameStyle}>
                {toolbar({})}
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th style={right}>Sales</th>
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
                <Card label="Growth rate" value={growthLabel} />
              </div>
              {csvLink(() => download(onsiteSalesToCsv(onsiteView), "onsite-sales.csv"))}
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

          {tab === "shopee" && (
            <>
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(shopeeViewTotal)} />
                <Card label="Orders" value={String(shopeeView.length)} />
                <Card
                  label="Profit"
                  value={shopeeHasProfit ? formatBahtTrim(shopeeViewProfit) : "—"}
                />
                <Card label="Fees" value={formatBahtTrim(shopeeViewFees)} />
              </div>
              {csvLink(() => download(onlineOrdersToCsv(shopeeView), "shopee-orders.csv"))}
              <div style={frameStyle}>
                {toolbar({
                  searchPlaceholder: "Search order / status / amount…",
                  statuses: shopeeStatuses,
                })}
                <OnlineOrders orders={shopeeView} />
              </div>
            </>
          )}

          {tab === "airplus" && (
            <>
              <div style={cardsRow}>
                <Card label="Revenue" value={formatBahtTrim(airplusSales)} />
                <Card label="Orders" value={String(airplusView.length)} />
                <Card label="Profit" value={formatBahtTrim(airplusProfit)} />
              </div>
              {csvLink(() => download(onlineOrdersToCsv(airplusView), "airplus-orders.csv"))}
              <div style={frameStyle}>
                {toolbar({
                  searchPlaceholder: "Search order / status / amount…",
                  statuses: airplusStatuses,
                })}
                <AirPlusOrders orders={airplusView} />
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
