"use client";

import type { CSSProperties } from "react";
import { totalCostSatang, commissionFeeSatang, profitSatang, marginPct } from "@/lib/pricing";

export interface PricingForm {
  costThb: string;
  taxOnCost: boolean;
  b2cThb: string;
  b2bThb: string;
  onlineThb: string;
  onlineCommPct: string;
}

export const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);
export const baht = (sat: number) => `฿${(sat / 100).toFixed(2)}`;

function MarginPill({ profit, price }: { profit: number; price: number }) {
  if (price <= 0) return <span className="muted">—</span>;
  const m = marginPct(profit, price);
  const cls = m < 0 ? "bad" : m < 15 ? "warn" : "good";
  return <span className={`pill ${cls}`}>{Math.round(m)}%</span>;
}

function Profit({ value, show }: { value: number; show: boolean }) {
  if (!show) return <span className="muted">—</span>;
  return (
    <span style={{ fontWeight: 600, color: value >= 0 ? "var(--ok)" : "var(--danger)" }}>
      {baht(value)}
    </span>
  );
}

const numStyle: CSSProperties = { width: 110, textAlign: "right" };

export function PricingFields({
  form,
  update,
}: {
  form: PricingForm;
  update: (patch: Partial<PricingForm>) => void;
}) {
  const tc = totalCostSatang(toSatang(form.costThb), form.taxOnCost);
  const b2c = toSatang(form.b2cThb);
  const b2b = toSatang(form.b2bThb);
  const online = toSatang(form.onlineThb);
  const commBp = Math.round((parseFloat(form.onlineCommPct) || 0) * 100);
  const fee = commissionFeeSatang(online, commBp);
  const onlineProfit = profitSatang(online, tc, fee);
  const b2cProfit = profitSatang(b2c, tc, 0);
  const b2bProfit = profitSatang(b2b, tc, 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 600 }}>Pricing</div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          background: "var(--hover)",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Item cost (฿)
          </span>
          <input
            value={form.costThb}
            onChange={(e) => update({ costThb: e.target.value })}
            style={{ width: 130 }}
          />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={form.taxOnCost}
              onChange={(e) => update({ taxOnCost: e.target.checked })}
            />
            <span className="slider" />
          </span>
          <span>Add VAT 7%</span>
        </label>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Total cost · base
          </div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{baht(tc)}</div>
        </div>
      </div>

      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr className="muted" style={{ fontSize: 12 }}>
            <th align="left">Tier</th>
            <th align="right">Price (฿)</th>
            <th align="right">Commission</th>
            <th align="right">Profit</th>
            <th align="right">Margin</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderTop: "1px solid var(--border)" }}>
            <td>Online · default</td>
            <td align="right">
              <input
                value={form.onlineThb}
                onChange={(e) => update({ onlineThb: e.target.value })}
                style={numStyle}
              />
            </td>
            <td align="right">
              <input
                value={form.onlineCommPct}
                onChange={(e) => update({ onlineCommPct: e.target.value })}
                style={{ width: 56, textAlign: "right" }}
              />
              %
              <div className="muted" style={{ fontSize: 11 }}>
                fee {baht(fee)}
              </div>
            </td>
            <td align="right">
              <Profit value={onlineProfit} show={online > 0} />
            </td>
            <td align="right">
              <MarginPill profit={onlineProfit} price={online} />
            </td>
          </tr>
          <tr style={{ borderTop: "1px solid var(--border)" }}>
            <td>On-site · B2C</td>
            <td align="right">
              <input
                value={form.b2cThb}
                onChange={(e) => update({ b2cThb: e.target.value })}
                style={numStyle}
              />
            </td>
            <td align="right" className="muted">
              —
            </td>
            <td align="right">
              <Profit value={b2cProfit} show={b2c > 0} />
            </td>
            <td align="right">
              <MarginPill profit={b2cProfit} price={b2c} />
            </td>
          </tr>
          <tr style={{ borderTop: "1px solid var(--border)" }}>
            <td>On-site · B2B</td>
            <td align="right">
              <input
                value={form.b2bThb}
                onChange={(e) => update({ b2bThb: e.target.value })}
                style={numStyle}
              />
            </td>
            <td align="right" className="muted">
              —
            </td>
            <td align="right">
              <Profit value={b2bProfit} show={b2b > 0} />
            </td>
            <td align="right">
              <MarginPill profit={b2bProfit} price={b2b} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
