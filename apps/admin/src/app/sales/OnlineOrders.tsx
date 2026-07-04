"use client";

import { type OrderRow } from "@/lib/api";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { orderStatusPill, paymentPill } from "@/lib/badges";
import { TableFrame } from "../TableFrame";

const right = { textAlign: "right" } as const;

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
            <th>When</th>
            <th style={right}>Total</th>
            <th style={right}>Fees</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td style={{ fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}>
                {o.externalOrderId}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                {o.orderCreatedAt ? (
                  formatUpdatedAt(o.orderCreatedAt)
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td style={right}>{formatBahtTrim(o.grandTotalSatang)}</td>
              <td style={right}>
                {o.feeTotalSatang ? (
                  formatBahtTrim(o.feeTotalSatang)
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                {o.orderStatus ? (
                  <span className={`pill ${orderStatusPill(o.orderStatus)}`}>{o.orderStatus}</span>
                ) : o.paymentStatus ? (
                  <span className={`pill ${paymentPill(o.paymentStatus)}`}>{o.paymentStatus}</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
