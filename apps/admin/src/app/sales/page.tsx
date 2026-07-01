"use client";

import { useEffect, useState } from "react";
import { apiBase, fetchSales, type SaleRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { rangeFor, summarize, type RangePreset } from "@/lib/salesSummary";
import { SalesTable } from "./SalesTable";

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

const dateInput = { minHeight: 0, padding: "8px 10px" } as const;

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    fetchSales()
      .then(setSales)
      .catch((err) => setError((err as Error).message));
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

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div style={card}>
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <main>
      <h1>Sales</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        On-site sales.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={p.key === preset ? "btn-primary btn-sm" : "btn-sm"}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <a href={`${apiBase}/sales/export.csv`}>Download CSV</a>
      </div>

      {preset === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            aria-label="From date"
            style={dateInput}
          />
          <span className="muted">–</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            aria-label="To date"
            style={dateInput}
          />
        </div>
      )}

      {sales === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <Card label="Revenue" value={formatBaht(s.revenueSatang)} />
            <Card label="Gross profit" value={formatBaht(s.grossProfitSatang)} />
            <Card label="VAT collected" value={formatBaht(s.vatSatang)} />
            <Card label="Sales" value={String(s.salesCount)} />
            <Card label="Refunds" value={`${s.refundCount} · ${formatBaht(s.refundedSatang)}`} />
          </div>
          <SalesTable sales={inRange} />
        </>
      )}
    </main>
  );
}
