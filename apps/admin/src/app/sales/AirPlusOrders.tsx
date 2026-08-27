"use client";

import type { CSSProperties } from "react";
import { type OrderRow, type ExpenseRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { operationalStatusBadge } from "@/lib/badges";
import { sumOrderMoney } from "@/lib/salesSummary";
import { tableText } from "@/lib/tableText";
import { TableFrame } from "../TableFrame";
import { OrderActionsMenu } from "../orders/OrderActionsMenu";
import { ExpenseRows } from "./ExpenseRows";
import { useT } from "../LangProvider";
import type { Phrase } from "@/lib/lang";

const dateTH = (ms: number) => new Date(ms).toLocaleDateString("th-TH");
const mono = { fontFamily: "var(--font-mono, monospace)" } as const;

/**
 * AirPlus orders (the owner's own single-seller site) — the money numbers per order, with the
 * same per-row "Actions ▾" dropdown the /orders table uses: View → the order's detail page, where
 * status / carrier / tracking are edited. Finance stays a money view; fulfilment lives on /orders.
 */
/** Written once: the `th` reads them, every `td` carries the matching one as `data-label` for the
 *  phone's card layout — so a card always says exactly what the header above it says. */
const COLUMN = {
  orderId: { th: "เลขคำสั่งซื้อ", en: "Order ID" },
  sales: { th: "ยอดขาย", en: "Sales" },
  profit: { th: "กำไร", en: "Profit" },
  date: { th: "วันที่", en: "Date" },
  status: { th: "สถานะ", en: "Status" },
  action: { th: "จัดการ", en: "Action" },
} satisfies Record<string, Phrase>;

export function AirPlusOrders({
  orders,
  expenses = [],
  onExpenseEdited,
  onExpenseDeleted,
}: {
  orders: OrderRow[];
  /** AirPlus expenses in the period — shown as rows and subtracted from the Total's Profit. */
  expenses?: ExpenseRow[];
  onExpenseEdited?: (e: ExpenseRow) => void;
  onExpenseDeleted?: (id: string) => void;
}) {
  const t = useT();
  if (orders.length === 0 && expenses.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">☁️</div>
        {t({ th: "ไม่มีคำสั่งซื้อ AirPlus ในช่วงนี้", en: "No AirPlus orders in this period." })}
      </div>
    );
  }
  const totals = sumOrderMoney(orders);
  const expenseSatang = expenses.reduce((sum, e) => sum + e.amountSatang, 0);
  return (
    <TableFrame cards>
      <table
        className="list-cards list-fixed"
        style={{ "--list-min-width": "900px" } as CSSProperties}
      >
        {/* Columns: Order ID (200) · Sales · Profit · Date · Status (160) · Action. Order ID and
            Status are pinned to the owner's widths; the middle four flex to fill the card.
            No inline comments between <col>s — they create whitespace text nodes (hydration error). */}
        <colgroup>
          <col style={{ width: 200 }} />
          <col />
          <col />
          <col />
          <col style={{ width: 160 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>{t(COLUMN.orderId)}</th>
            <th>{t(COLUMN.sales)}</th>
            <th>{t(COLUMN.profit)}</th>
            <th>{t(COLUMN.date)}</th>
            <th>{t(COLUMN.status)}</th>
            <th>{t(COLUMN.action)}</th>
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
                <td data-label={t(COLUMN.sales)}>
                  {o.salesSatang != null ? (
                    formatBahtTrim(o.salesSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Profit = Sales − cost (own site, known cost) */}
                <td data-label={t(COLUMN.profit)}>
                  {o.profitSatang != null ? (
                    formatBahtTrim(o.profitSatang)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {/* Ordered date */}
                <td data-label={t(COLUMN.date)} style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>{dateTH(o.orderCreatedAt ?? o.importedAt)}</div>
                </td>
                <td data-label={t(COLUMN.status)}>
                  <span className={`pill ${badge.pill}`}>{t(badge.label)}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <OrderActionsMenu orderId={o.id} />
                </td>
              </tr>
            );
          })}
          {/* Expense rows — money out; subtracted from the Total below. */}
          <ExpenseRows
            expenses={expenses}
            onEdited={(e) => onExpenseEdited?.(e)}
            onDeleted={(id) => onExpenseDeleted?.(id)}
          />
          {/* Total row — Σ Sales and net Profit (orders − expenses), matching the Summary table. */}
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
            <td>{t({ th: "รวม", en: "Total" })}</td>
            <td data-label={t(COLUMN.sales)}>{formatBahtTrim(totals.salesSatang)}</td>
            <td data-label={t(COLUMN.profit)}>
              {formatBahtTrim(totals.profitSatang - expenseSatang)}
            </td>
            <td />
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </TableFrame>
  );
}
