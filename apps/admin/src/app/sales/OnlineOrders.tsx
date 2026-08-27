"use client";

import { type OrderRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { shopeeStatusBadge } from "@/lib/badges";
import { tableText } from "@/lib/tableText";
import { TableFrame } from "../TableFrame";
import { useT } from "../LangProvider";
import { COLUMN } from "./columns";

const DAY_MS = 24 * 60 * 60 * 1000;
const feePct = (bp: number) => `${parseFloat((bp / 100).toFixed(2))}%`;
const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");

/** Read-only table of online marketplace orders (Shopee today, AirPlus later) for a channel section. */

export function OnlineOrders({ orders }: { orders: OrderRow[] }) {
  const t = useT();
  if (orders.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🛒</div>
        {t({ th: "ไม่มีคำสั่งซื้อในช่วงนี้", en: "No orders in this period." })}
      </div>
    );
  }
  return (
    <TableFrame cards>
      <table className="list-cards">
        <thead>
          <tr>
            <th>{t(COLUMN.orderId)}</th>
            <th>{t(COLUMN.sales)}</th>
            <th>{t(COLUMN.total)}</th>
            <th>{t(COLUMN.fees)}</th>
            <th>{t(COLUMN.profit)}</th>
            <th>{t(COLUMN.date)}</th>
            <th>{t(COLUMN.status)}</th>
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
                <td data-label={t(COLUMN.sales)}>
                  {o.salesSatang != null ? (
                    formatBahtTrim(o.salesSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Total = amount the seller receives */}
                <td data-label={t(COLUMN.total)}>{formatBahtTrim(o.grandTotalSatang)}</td>
                {/* Fees = total Shopee charge (THB) + the charged rate */}
                <td data-label={t(COLUMN.fees)} style={{ whiteSpace: "nowrap" }}>
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
                <td data-label={t(COLUMN.profit)}>
                  {o.profitSatang != null ? (
                    formatBahtTrim(o.profitSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Ship date + estimated completion (ship + 10 days) */}
                <td data-label={t(COLUMN.date)} style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>{dateTH(shipMs)}</div>
                  <div style={tableText.subtitle}>~ {dateTH(shipMs + 10 * DAY_MS)}</div>
                </td>
                <td data-label={t(COLUMN.status)}>
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
