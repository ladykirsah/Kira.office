"use client";

import { type SaleRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { saleStatusPill, saleTypeBadge, vehicleLabel, stripCarYear } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { RefundButton } from "./RefundButton";

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
      <table style={{ tableLayout: "fixed", minWidth: 900 }}>
        {/* Job holds the widest content (tag + car · plate); the other five share the rest evenly. */}
        <colgroup>
          <col style={{ width: "38%" }} />
          <col style={{ width: "12.4%" }} />
          <col style={{ width: "12.4%" }} />
          <col style={{ width: "12.4%" }} />
          <col style={{ width: "12.4%" }} />
          <col style={{ width: "12.4%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Job</th>
            <th>Total</th>
            <th>Profit</th>
            <th>Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => {
            const type = saleTypeBadge(s.saleType);
            // Col-2 top line: a Service shows its vehicle (car model without year · plate);
            // a Products sale shows its channel instead.
            const desc =
              s.saleType === "parts"
                ? s.channel === "online"
                  ? "Online"
                  : "On-site"
                : vehicleLabel(stripCarYear(s.vehicle), s.licensePlate);
            return (
              <tr key={s.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {type ? <span className={`pill ${type.pill}`}>{type.label}</span> : "—"}
                    <div>
                      {desc && <div style={tableText.body2}>{desc}</div>}
                      <div
                        style={{
                          ...tableText.subtitle,
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {s.saleNumber ?? <span className="muted">—</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{formatBahtTrim(s.grandTotalSatang)}</td>
                <td>{formatBahtTrim(s.grossProfitSatang)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>
                    {new Date(s.createdAt).toLocaleDateString("th-TH")}
                  </div>
                  <div style={tableText.subtitle}>
                    {new Date(s.createdAt).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </td>
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
