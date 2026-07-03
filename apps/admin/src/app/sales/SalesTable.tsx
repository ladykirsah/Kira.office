"use client";

import { type SaleRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { saleStatusPill, saleTypeBadge, vehicleLabel } from "@/lib/badges";
import { RefundButton } from "./RefundButton";

const right = { textAlign: "right" } as const;

/** The Onsite sales rows. Search / sort / filter / period live in the page's table frame around it. */
export function SalesTable({ sales }: { sales: SaleRow[] }) {
  if (sales.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">💰</div>No sales for this view.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>When</th>
            <th>Job</th>
            <th style={right}>Total</th>
            <th style={right}>Profit</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => {
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
                <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono, monospace)" }}>
                  {s.saleNumber ?? <span className="muted">—</span>}
                </td>
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
    </div>
  );
}
