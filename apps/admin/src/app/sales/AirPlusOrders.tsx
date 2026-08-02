"use client";

import { type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { operationalStatusBadge } from "@/lib/badges";
import { sumOrderMoney } from "@/lib/salesSummary";
import { tableText } from "@/lib/tableText";
import { TableFrame } from "../TableFrame";
import { OrderActionsMenu } from "../orders/OrderActionsMenu";

const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");
const mono = { fontFamily: "var(--font-mono, monospace)" } as const;

/**
 * AirPlus orders (the owner's own single-seller site) — the money numbers per order, with the
 * same per-row "Actions ▾" dropdown the /orders table uses: View → the order's detail page, where
 * status / carrier / tracking are edited. Finance stays a money view; fulfilment lives on /orders.
 */
export function AirPlusOrders({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">☁️</div>No AirPlus orders in this period.
      </div>
    );
  }
  const totals = sumOrderMoney(orders);
  return (
    <TableFrame>
      <table style={{ tableLayout: "fixed", minWidth: 900 }}>
        {/* Order ID and Status are pinned to the owner's widths (200 / 160); the middle four
            columns flex to fill the rest so the table still spans the card. */}
        <colgroup>
          <col style={{ width: 200 }} /> {/* Order ID */}
          <col /> {/* Sales */}
          <col /> {/* Profit */}
          <col /> {/* Date */}
          <col style={{ width: 160 }} /> {/* Status */}
          <col /> {/* Action */}
        </colgroup>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Sales</th>
            <th>Profit</th>
            <th>Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            // Same status the /orders page shows: the owner's operational states derived from BOTH
            // axes (order + payment), so an AirPlus row reads identically here and there.
            const badge = operationalStatusBadge(o.orderStatus, o.paymentStatus);
            return (
              <tr key={o.id}>
                {/* Order ID */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ ...tableText.body2, ...mono }}>{o.externalOrderId}</div>
                </td>
                {/* Sales = goods revenue the customer paid (shipping excluded) */}
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
                {/* Ordered date */}
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>{dateTH(o.orderCreatedAt ?? o.importedAt)}</div>
                </td>
                <td>
                  <span className={`pill ${badge.pill}`}>{badge.label}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <OrderActionsMenu orderId={o.id} />
                </td>
              </tr>
            );
          })}
          {/* Total row — Σ Sales and Σ Profit of the rows shown, matching the Summary table. */}
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
            <td>Total</td>
            <td>{formatBahtTrim(totals.salesSatang)}</td>
            <td>{formatBahtTrim(totals.profitSatang)}</td>
            <td />
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </TableFrame>
  );
}
