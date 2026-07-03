"use client";

import { useEffect, useState } from "react";
import { apiBase, fetchSales, fetchOrders, type SaleRow, type OrderRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import {
  rangeFor,
  summarize,
  totalChannelSales,
  type RangePreset,
  type ChannelSales,
} from "@/lib/salesSummary";
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
  const inRange = (sales ?? []).filter(
    (s) => s.createdAt >= range.startMs && s.createdAt < range.endMs,
  );
  const s = summarize(inRange, range);

  const shopeeInRange = (orders ?? []).filter(
    (o) => o.channel === "shopee" && orderDate(o) >= range.startMs && orderDate(o) < range.endMs,
  );
  const shopeeTotal = shopeeInRange.reduce((sum, o) => sum + o.grandTotalSatang, 0);

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
      <h1>Sales</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        Product sales by channel.
      </p>

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
          {preset === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="From date"
                style={inputS}
              />
              <span className="muted">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="To date"
                style={inputS}
              />
            </>
          )}
        </div>
        <a href={`${apiBase}/sales/export.csv`}>Download CSV</a>
      </div>

      {sales === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          <div className="tabs">
            <TabBtn id="summary" label="Summary" />
            <TabBtn id="onsite" label={`Onsite (${s.salesCount})`} />
            <TabBtn id="shopee" label={`Shopee (${shopeeInRange.length})`} />
            <TabBtn id="airplus" label="AirPlus" />
          </div>

          {tab === "summary" && (
            <div className="card" style={{ overflowX: "auto" }}>
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

          {tab === "shopee" && <OnlineOrders orders={shopeeInRange} />}

          {tab === "airplus" && (
            <div className="empty">
              <div className="empty-icon">☁️</div>AirPlus orders will appear here once its channel
              is connected.
            </div>
          )}
        </>
      )}
    </main>
  );
}
