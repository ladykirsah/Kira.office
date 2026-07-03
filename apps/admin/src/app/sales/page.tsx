"use client";

import { useEffect, useState } from "react";
import { apiBase, fetchSales, fetchOrders, type SaleRow, type OrderRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import {
  rangeFor,
  summarize,
  totalChannelSales,
  toDateInputValue,
  type RangePreset,
  type ChannelSales,
} from "@/lib/salesSummary";
import { PageHeader } from "../PageHeader";
import { SalesTable } from "./SalesTable";
import { OnlineOrders } from "./OnlineOrders";

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

  useEffect(() => {
    fetchSales()
      .then(setSales)
      .catch((err) => setError((err as Error).message));
    fetchOrders()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

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

  const shopeeInRange = (orders ?? []).filter(
    (o) => o.channel === "shopee" && orderDate(o) >= range.startMs && orderDate(o) < range.endMs,
  );
  const shopeeTotal = shopeeInRange.reduce((sum, o) => sum + o.grandTotalSatang, 0);
  const shopeeFees = shopeeInRange.reduce((sum, o) => sum + (o.feeTotalSatang ?? 0), 0);

  // Group 1 — product sales across channels (roll-up shown in the summary table).
  const channelRows: ChannelSales[] = [
    { key: "onsite", label: "Onsite", count: s.salesCount, revenueSatang: s.revenueSatang },
    { key: "shopee", label: "Shopee", count: shopeeInRange.length, revenueSatang: shopeeTotal },
    { key: "airplus", label: "AirPlus", count: 0, revenueSatang: 0 },
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

  return (
    <main>
      <PageHeader title="Sales" subtitle="Product sales by channel." />

      <div className="tabs">
        <TabBtn id="summary" label={`Summary (${channelTotal.count})`} />
        <TabBtn id="onsite" label={`Onsite (${s.salesCount})`} />
        <TabBtn id="shopee" label={`Shopee (${shopeeInRange.length})`} />
        <TabBtn id="airplus" label="AirPlus (0)" />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Period</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RangePreset)}
            aria-label="Date range"
            style={inputS}
          >
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
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
        <a href={`${apiBase}/sales/export.csv`}>Download CSV</a>
      </div>

      {sales === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          {tab === "summary" && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <Card label="Total revenue" value={formatBaht(channelTotal.revenueSatang)} />
                <Card label="Total sales" value={String(channelTotal.count)} />
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 18,
                  overflowX: "auto",
                }}
              >
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
                        <td style={right}>{formatBaht(r.revenueSatang)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
                      <td>Total</td>
                      <td style={right}>{channelTotal.count}</td>
                      <td style={right}>{formatBaht(channelTotal.revenueSatang)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "onsite" && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <Card label="Revenue" value={formatBaht(s.revenueSatang)} />
                <Card label="Gross profit" value={formatBaht(s.grossProfitSatang)} />
                <Card label="VAT collected" value={formatBaht(s.vatSatang)} />
                <Card label="Sales" value={String(s.salesCount)} />
                <Card
                  label="Refunds"
                  value={`${s.refundCount} · ${formatBaht(s.refundedSatang)}`}
                />
              </div>
              <SalesTable sales={inRange} />
            </>
          )}

          {tab === "shopee" && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <Card label="Revenue" value={formatBaht(shopeeTotal)} />
                <Card label="Orders" value={String(shopeeInRange.length)} />
                <Card label="Fees" value={formatBaht(shopeeFees)} />
              </div>
              <OnlineOrders orders={shopeeInRange} />
            </>
          )}

          {tab === "airplus" && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <Card label="Revenue" value={formatBaht(0)} />
                <Card label="Orders" value="0" />
              </div>
              <div className="empty">
                <div className="empty-icon">☁️</div>AirPlus orders will appear here once its channel
                is connected.
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
