"use client";

import { type SaleRow, type ExpenseRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { saleStatusPill, saleTypeBadge } from "@/lib/badges";
import { sumSaleMoney } from "@/lib/salesSummary";
import { tableText } from "@/lib/tableText";
import { SalesActionsMenu } from "./SalesActionsMenu";
import { ExpenseRows } from "./ExpenseRows";

/** The Onsite sales rows. Search / sort / filter / period live in the page's table frame around it. */
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
    <div style={{ overflowX: "auto" }}>
      <table style={{ tableLayout: "fixed", minWidth: 900 }}>
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
            <th>Job</th>
            <th>Sales</th>
            <th>Profit</th>
            <th>Date</th>
            <th>Status</th>
            <th>Action</th>
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
                <td>{formatBahtTrim(s.grandTotalSatang)}</td>
                <td>{formatBahtTrim(s.grossProfitSatang)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>
                    {new Date(s.createdAt).toLocaleDateString("th-TH")}
                  </div>
                </td>
                <td>
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
            <td>{formatBahtTrim(totals.salesSatang)}</td>
            <td>{formatBahtTrim(totals.profitSatang - expenseSatang)}</td>
            <td />
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
