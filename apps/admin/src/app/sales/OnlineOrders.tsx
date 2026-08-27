"use client";

import { type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { shopeeStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { TableFrame } from "../TableFrame";
import { useT } from "../LangProvider";

const DAY_MS = 24 * 60 * 60 * 1000;
const feePct = (bp: number) => `${parseFloat((bp / 100).toFixed(2))}%`;
const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");

/** Read-only table of online marketplace orders (Shopee today, AirPlus later) for a channel section. */
/** Written once: the `th` reads them, every `td` carries the matching one as `data-label` for the
 *  phone's card layout. Plain strings — this page has not been through the bilingual sweep, and a
 *  card must say exactly what the header says, not translate it. */
const COLUMN = {
  orderId: "Order ID",
  sales: "Sales",
  total: "Total",
  fees: "Fees",
  profit: "Profit",
  date: "Date",
  status: "Status",
};

export function OnlineOrders({ orders }: { orders: OrderRow[] }) {
  const t = useT();
  if (orders.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🛒</div>No orders in this period.
      </div>
    );
  }
  return (
    <TableFrame cards>
      <table className="list-cards">
        <thead>
          <tr>
            <th>{COLUMN.orderId}</th>
            <th>{COLUMN.sales}</th>
            <th>{COLUMN.total}</th>
            <th>{COLUMN.fees}</th>
            <th>{COLUMN.profit}</th>
            <th>{COLUMN.date}</th>
            <th>{COLUMN.status}</th>
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
                <td data-label={COLUMN.sales}>
                  {o.salesSatang != null ? (
                    formatBahtTrim(o.salesSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Total = amount the seller receives */}
                <td data-label={COLUMN.total}>{formatBahtTrim(o.grandTotalSatang)}</td>
                {/* Fees = total Shopee charge (THB) + the charged rate */}
                <td data-label={COLUMN.fees} style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>
                    {o.feeTotalSatang ? (
                      formatBahtTrim(o.feeTotalSatang)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                  {o.feeBp ? <div style={tableText.subtitle}>{feePct(o.feeBp)}</div> : null}
                </td>
                {/* Profit = Total − Kira cost; null until order line SKUs are matched to products.
                    When populated, render like the Fees cell: profit THB (body2) + margin %
                    (subtitle). */}
                <td data-label={COLUMN.profit}>
                  {o.profitSatang != null ? (
                    formatBahtTrim(o.profitSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Ship date + estimated completion (ship + 10 days) */}
                <td data-label={COLUMN.date} style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>{dateTH(shipMs)}</div>
                  <div style={tableText.subtitle}>~ {dateTH(shipMs + 10 * DAY_MS)}</div>
                </td>
                <td data-label={COLUMN.status}>
                  <span className={`pill ${badge.pill}`}>{t(badge.label)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}
