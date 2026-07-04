"use client";

import { type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { shopeeStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { TableFrame } from "../TableFrame";

const DAY_MS = 24 * 60 * 60 * 1000;
const feePct = (bp: number) => `${parseFloat((bp / 100).toFixed(2))}%`;
const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");

/** Read-only table of online marketplace orders (Shopee today, AirPlus later) for a channel section. */
export function OnlineOrders({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🛒</div>No orders in this period.
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
            <th>Total</th>
            <th>Fees</th>
            <th>Profit</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const badge = shopeeStatusBadge(o.orderStatus);
            const shipMs = o.shipTimeMs ?? o.orderCreatedAt ?? o.importedAt;
            return (
              <tr key={o.id}>
                {/* Order ID + buyer username */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ ...tableText.body2, fontFamily: "var(--font-mono, monospace)" }}>
                    {o.externalOrderId}
                  </div>
                  {o.buyerUsername && <div style={tableText.subtitle}>{o.buyerUsername}</div>}
                </td>
                {/* Sales = amount the buyer paid for the product */}
                <td>
                  {o.salesSatang != null ? (
                    formatBahtTrim(o.salesSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Total = amount the seller receives */}
                <td>{formatBahtTrim(o.grandTotalSatang)}</td>
                {/* Fees = total Shopee charge (THB) + the charged rate */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>
                    {o.feeTotalSatang ? (
                      formatBahtTrim(o.feeTotalSatang)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                  {o.feeBp ? <div style={tableText.subtitle}>{feePct(o.feeBp)}</div> : null}
                </td>
                {/* Profit = Total − Kira cost; null until order line SKUs are matched to products */}
                <td>
                  {o.profitSatang != null ? (
                    formatBahtTrim(o.profitSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Ship date + estimated completion (ship + 10 days) */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>{dateTH(shipMs)}</div>
                  <div style={tableText.subtitle}>~ {dateTH(shipMs + 10 * DAY_MS)}</div>
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
