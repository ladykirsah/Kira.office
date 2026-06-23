"use client";

import { useState } from "react";
import { type SaleRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { RefundButton } from "./RefundButton";

export function SalesTable({ sales }: { sales: SaleRow[] }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? sales : sales.filter((s) => s.saleStatus === filter);

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <label>
          Show{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">all</option>
            <option value="completed">completed</option>
            <option value="refunded">refunded</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💰</div>
          {sales.length === 0
            ? "No sales yet. Sales from the POS appear here."
            : "No matching sales."}
        </div>
      ) : (
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">When</th>
              <th align="left">Payment</th>
              <th align="right">Total</th>
              <th align="right">Profit</th>
              <th align="left">Status</th>
              <th align="left"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td>{new Date(s.createdAt).toLocaleString("th-TH")}</td>
                <td>{s.paymentMethod ?? "—"}</td>
                <td align="right">{formatBaht(s.grandTotalSatang)}</td>
                <td align="right">{formatBaht(s.grossProfitSatang)}</td>
                <td>{s.saleStatus}</td>
                <td>
                  <RefundButton saleId={s.id} status={s.saleStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
