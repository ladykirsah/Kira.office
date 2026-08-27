"use client";

import type { CSSProperties } from "react";
import { type SaleRow, type ExpenseRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { saleStatusPill, saleTypeBadge } from "@/lib/badges";
import { sumSaleMoney } from "@/lib/salesSummary";
import { tableText } from "@/lib/tableText";
import { SalesActionsMenu } from "./SalesActionsMenu";
import { ExpenseRows } from "./ExpenseRows";

/** The Onsite sales rows. Search / sort / filter / period live in the page's table frame around it. */
/** Written once: the `th` reads them, every `td` carries the matching one as `data-label` for the
 *  phone's card layout. Plain strings — this page has not been through the bilingual sweep, and a
 *  card must say exactly what the header says, not translate it. */
const COLUMN = {
  job: "Job",
  sales: "Sales",
  profit: "Profit",
  date: "Date",
  status: "Status",
  action: "Action",
};

export function SalesTable({
  sales,
  expenses = [],
  onExpenseEdited,
  onExpenseDeleted,
}: {
  sales: SaleRow[];
  /** Den Air expenses in the period — money-out rows with a negative Profit. */
  expenses?: ExpenseRow[];
  onExpenseEdited?: (e: ExpenseRow) => void;
  onExpenseDeleted?: (id: string) => void;
}) {
  if (sales.length === 0 && expenses.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">💰</div>No sales for this view.
      </div>
    );
  }

  const totals = sumSaleMoney(sales);
  const expenseSatang = expenses.reduce((sum, e) => sum + e.amountSatang, 0);

  return (
    <div className="list-cards-scroll">
      <table
        className="list-cards list-fixed"
        style={{ "--list-min-width": "900px" } as CSSProperties}
      >
        {/* Job (tag + bill id) needs a bit more room; the other five share the rest evenly. */}
        <colgroup>
          <col style={{ width: "30%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>{COLUMN.job}</th>
            <th>{COLUMN.sales}</th>
            <th>{COLUMN.profit}</th>
            <th>{COLUMN.date}</th>
            <th>{COLUMN.status}</th>
            <th>{COLUMN.action}</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => {
            const type = saleTypeBadge(s.saleType);
            return (
              <tr key={s.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {type ? <span className={`pill ${type.pill}`}>{type.label}</span> : "—"}
                    <span style={{ ...tableText.body2, fontFamily: "var(--font-mono, monospace)" }}>
                      {s.saleNumber ?? <span className="muted">—</span>}
                    </span>
                  </div>
                </td>
                <td data-label={COLUMN.sales}>{formatBahtTrim(s.grandTotalSatang)}</td>
                <td data-label={COLUMN.profit}>{formatBahtTrim(s.grossProfitSatang)}</td>
                <td data-label={COLUMN.date} style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>
                    {new Date(s.createdAt).toLocaleDateString("th-TH")}
                  </div>
                </td>
                <td data-label={COLUMN.status}>
                  <span className={`pill ${saleStatusPill(s.saleStatus)}`}>{s.saleStatus}</span>
                </td>
                <td>
                  <SalesActionsMenu
                    saleId={s.id}
                    saleStatus={s.saleStatus}
                    licensePlate={s.licensePlate}
                  />
                </td>
              </tr>
            );
          })}
          <ExpenseRows
            expenses={expenses}
            onEdited={(e) => onExpenseEdited?.(e)}
            onDeleted={(id) => onExpenseDeleted?.(id)}
          />
          {/* Total row — Sales = Σ bill totals, Profit = Σ gross profit − expenses (net). */}
          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 600 }}>
            <td>Total</td>
            <td data-label={COLUMN.sales}>{formatBahtTrim(totals.salesSatang)}</td>
            <td data-label={COLUMN.profit}>
              {formatBahtTrim(totals.profitSatang - expenseSatang)}
            </td>
            <td />
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
