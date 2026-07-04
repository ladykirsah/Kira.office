"use client";

import { type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { airplusStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { TableFrame } from "../TableFrame";

const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");
const mono = { fontFamily: "var(--font-mono, monospace)" } as const;

/**
 * Read-only summary of AirPlus orders (the owner's own single-seller site). Just the sales numbers
 * here; the full conversion detail lives in Kira and drills down from the row (detail view TBD).
 */
export function AirPlusOrders({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">☁️</div>No AirPlus orders in this period.
      </div>
    );
  }
  return (
    <TableFrame>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Sales</th>
            <th>Profit</th>
            <th>Carrier</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const badge = airplusStatusBadge(o.orderStatus);
            return (
              <tr key={o.id}>
                {/* Order ID + username */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ ...tableText.body2, ...mono }}>{o.externalOrderId}</div>
                  {o.buyerUsername && <div style={tableText.subtitle}>{o.buyerUsername}</div>}
                </td>
                {/* Sales = what the customer paid (no commission → seller keeps it) */}
                <td>
                  {o.salesSatang != null ? (
                    formatBahtTrim(o.salesSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Profit = Sales − cost (own site, known cost) */}
                <td>
                  {o.profitSatang != null ? (
                    formatBahtTrim(o.profitSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Carrier tag + tracking no. */}
                <td style={{ whiteSpace: "nowrap" }}>
                  {o.carrier ? (
                    <span className="pill off">{o.carrier}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {o.trackingNo && (
                    <div style={{ ...tableText.subtitle, ...mono, marginTop: 4 }}>
                      {o.trackingNo}
                    </div>
                  )}
                </td>
                {/* Ordered date + shipped date */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>{dateTH(o.orderCreatedAt ?? o.importedAt)}</div>
                  <div style={tableText.subtitle}>
                    {o.shipTimeMs ? `→ ${dateTH(o.shipTimeMs)}` : "—"}
                  </div>
                </td>
                <td>
                  <span className={`pill ${badge.pill}`}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}
