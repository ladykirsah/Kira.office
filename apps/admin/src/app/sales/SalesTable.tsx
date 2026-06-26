"use client";

import { useState } from "react";
import { type SaleRow } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { formatBaht } from "@/lib/format";
import { saleStatusPill, saleTypeBadge, vehicleLabel } from "@/lib/badges";
import { RefundButton } from "./RefundButton";

const right = { textAlign: "right" } as const;

export function SalesTable({ sales }: { sales: SaleRow[] }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? sales : sales.filter((s) => s.saleStatus === filter);

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ marginBottom: 12 }}>
        <label>
          Show{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={inputS}>
            <option value="all">all</option>
            <option value="completed">completed</option>
            <option value="refunded">refunded</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💰</div>
          {sales.length === 0
            ? "No sales yet. Sales from the POS appear here."
            : "No matching sales."}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Job</th>
              <th style={right}>Total</th>
              <th style={right}>Profit</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const type = saleTypeBadge(s.saleType);
              const veh = vehicleLabel(s.vehicle, s.licensePlate);
              // Repair rows show the vehicle; Parts rows show the channel (Online / On-site).
              const sub =
                s.saleType === "repair"
                  ? veh
                  : s.saleType === "parts"
                    ? s.channel === "online"
                      ? "Online"
                      : "On-site"
                    : "";
              return (
                <tr key={s.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(s.createdAt).toLocaleString("th-TH")}
                  </td>
                  <td>
                    {type ? <span className={`pill ${type.pill}`}>{type.label}</span> : "—"}
                    {sub && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {sub}
                      </div>
                    )}
                  </td>
                  <td style={right}>{formatBaht(s.grandTotalSatang)}</td>
                  <td style={right}>{formatBaht(s.grossProfitSatang)}</td>
                  <td>
                    <span className={`pill ${saleStatusPill(s.saleStatus)}`}>{s.saleStatus}</span>
                  </td>
                  <td>
                    <RefundButton saleId={s.id} status={s.saleStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
