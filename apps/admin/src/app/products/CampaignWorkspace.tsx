"use client";

import { useState } from "react";
import { commissionFeeSatang, profitSatang, marginPct } from "@/lib/pricing";
import { toSatang, baht } from "./PricingFields";

interface Scenario {
  price: string;
  comm: string;
}

/** Campaign what-if scratchpad. Purely client-side — nothing here is saved on the product. */
export function CampaignWorkspace({
  totalCostSatang,
  defaultProfitSatang,
}: {
  totalCostSatang: number;
  defaultProfitSatang: number;
}) {
  const [rows, setRows] = useState<Scenario[]>([
    { price: "102", comm: "10" },
    { price: "99", comm: "12" },
  ]);
  const patch = (i: number, p: Partial<Scenario>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const add = () => setRows((rs) => [...rs, { price: "100", comm: "10" }]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 600 }}>Campaign workspace</span>
        <span className="pill warn">scratch · not saved</span>
      </div>
      <div
        style={{
          background: "var(--hover)",
          border: "1px dashed var(--border)",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Baseline — saved online default profit{" "}
          <span style={{ color: "var(--ok)", fontWeight: 600 }}>{baht(defaultProfitSatang)}</span>
        </div>
        <table className="ptbl">
          <thead>
            <tr>
              <th>Try</th>
              <th>Price (฿)</th>
              <th>Comm.</th>
              <th>Profit</th>
              <th>Margin</th>
              <th>vs default</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const price = toSatang(r.price);
              const fee = commissionFeeSatang(price, Math.round((parseFloat(r.comm) || 0) * 100));
              const profit = profitSatang(price, totalCostSatang, fee);
              const m = marginPct(profit, price);
              const delta = profit - defaultProfitSatang;
              const cls = m < 0 ? "bad" : m < 15 ? "warn" : "good";
              return (
                <tr key={i}>
                  <td>{String.fromCharCode(65 + i)}</td>
                  <td>
                    <input
                      value={r.price}
                      onChange={(e) => patch(i, { price: e.target.value })}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <input
                        value={r.comm}
                        onChange={(e) => patch(i, { comm: e.target.value })}
                        style={{ width: 48 }}
                      />
                      <span className="muted">%</span>
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        color: profit >= 0 ? "var(--ok)" : "var(--danger)",
                      }}
                    >
                      {price > 0 ? baht(profit) : "—"}
                    </span>
                  </td>
                  <td>
                    {price > 0 ? <span className={`pill ${cls}`}>{Math.round(m)}%</span> : "—"}
                  </td>
                  <td style={{ color: delta >= 0 ? "var(--ok)" : "var(--danger)" }}>
                    {price > 0 ? `${delta >= 0 ? "+" : "−"}${baht(Math.abs(delta))}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={add} style={{ marginTop: 10 }}>
          + Add scenario
        </button>
      </div>
    </div>
  );
}
