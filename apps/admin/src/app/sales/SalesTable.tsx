"use client";

import type { CSSProperties } from "react";
import { type SaleRow, type ExpenseRow } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { saleStatusPill, saleStatusLabel, saleTypeBadge } from "@/lib/badges";
import { sumSaleMoney } from "@/lib/salesSummary";
import { tableText } from "@/lib/tableText";
import { SalesActionsMenu } from "./SalesActionsMenu";
import { ExpenseRows } from "./ExpenseRows";
import { useT } from "../LangProvider";
import { COLUMN } from "./columns";

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
  const t = useT();
  if (sales.length === 0 && expenses.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">💰</div>
        {t({ th: "ไม่มีรายการขายในมุมมองนี้", en: "No sales for this view." })}
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
            <th>{t(COLUMN.job)}</th>
            <th>{t(COLUMN.sales)}</th>
            <th>{t(COLUMN.profit)}</th>
            <th>{t(COLUMN.date)}</th>
            <th>{t(COLUMN.status)}</th>
            <th>{t(COLUMN.action)}</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => {
            const type = saleTypeBadge(s.saleType);
            return (
              <tr key={s.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {type ? <span className={`pill ${type.pill}`}>{t(type.label)}</span> : "—"}
                    <span style={{ ...tableText.body2, fontFamily: "var(--font-mono, monospace)" }}>
                      {s.saleNumber ?? <span className="muted">—</span>}
                    </span>
                  </div>
                </td>
                <td data-label={t(COLUMN.sales)}>{formatBahtTrim(s.grandTotalSatang)}</td>
                <td data-label={t(COLUMN.profit)}>{formatBahtTrim(s.grossProfitSatang)}</td>
                <td data-label={t(COLUMN.date)} style={{ whiteSpace: "nowrap" }}>
                  <div style={tableText.body2}>
                    {new Date(s.createdAt).toLocaleDateString("th-TH")}
                  </div>
                </td>
                <td data-label={t(COLUMN.status)}>
                  <span className={`pill ${saleStatusPill(s.saleStatus)}`}>
                    {t(saleStatusLabel(s.saleStatus))}
                  </span>
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
    </div>
  );
}
