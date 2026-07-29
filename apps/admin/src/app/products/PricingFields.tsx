"use client";

import type { CSSProperties } from "react";
import { totalCostSatang, commissionFeeSatang, profitSatang, marginPct } from "@/lib/pricing";
import { inputS } from "@/lib/inputStyles";

export interface PricingForm {
  costThb: string;
  taxOnCost: boolean;
  b2cThb: string;
  b2bThb: string;
  onlineThb: string;
  shopeeThb: string;
  onlineCommPct: string;
}

export const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);
export const baht = (sat: number) => `฿${(sat / 100).toFixed(2)}`;

function MarginBar({ profit, price }: { profit: number; price: number }) {
  if (price <= 0) return <span className="muted">—</span>;
  const m = marginPct(profit, price);
  const cls = m < 0 ? "bad" : m < 15 ? "warn" : "good";
  const w = Math.max(0, Math.min(100, m));
  return (
    <span className="mwrap">
      <span className="mtrack">
        <span className={`mfill ${cls}`} style={{ width: `${w}%` }} />
      </span>
      <span className="mpct">{Math.round(m)}%</span>
    </span>
  );
}

function Profit({ value, show }: { value: number; show: boolean }) {
  if (!show) return <span className="muted">—</span>;
  return (
    <span
      style={{ fontSize: 14, fontWeight: 600, color: value >= 0 ? "var(--ok)" : "var(--danger)" }}
    >
      {baht(value)}
    </span>
  );
}

const numStyle: CSSProperties = { ...inputS, width: "min(110px, 100%)" };

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
  const shopee = toSatang(form.shopeeThb);
  const commBp = Math.round((parseFloat(form.onlineCommPct) || 0) * 100);
  const fee = commissionFeeSatang(online, commBp);
  // Commission is a marketplace fee, so it belongs to Shopee (AC on Sales) — AirPlus is the
  // owner's own shop and pays none.
  const shopeeProfit = profitSatang(shopee, tc, fee);
  const onlineProfit = profitSatang(online, tc, 0);
  const b2cProfit = profitSatang(b2c, tc, 0);
  const b2bProfit = profitSatang(b2b, tc, 0);

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--surface)",
      }}
    >
      <div style={{ fontWeight: 600 }}>Pricing</div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Item cost ฿
            </span>
            <input
              value={form.costThb}
              onChange={(e) => update({ costThb: e.target.value })}
              style={{ ...inputS, width: 92 }}
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
            <span style={{ fontSize: 12 }}>Add VAT 7%</span>
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Total cost · base
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{baht(tc)}</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="ptbl">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "22%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Price (฿)</th>
              <th>Commission</th>
              <th>Profit</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Den Air Service</td>
              <td>
                <input
                  value={form.b2cThb}
                  onChange={(e) => update({ b2cThb: e.target.value })}
                  style={numStyle}
                />
              </td>
              <td className="muted">—</td>
              <td>
                <Profit value={b2cProfit} show={b2c > 0} />
              </td>
              <td>
                <MarginBar profit={b2cProfit} price={b2c} />
              </td>
            </tr>
            <tr>
              <td>B2B</td>
              <td>
                <input
                  value={form.b2bThb}
                  onChange={(e) => update({ b2bThb: e.target.value })}
                  style={numStyle}
                />
              </td>
              <td className="muted">—</td>
              <td>
                <Profit value={b2bProfit} show={b2b > 0} />
              </td>
              <td>
                <MarginBar profit={b2bProfit} price={b2b} />
              </td>
            </tr>
            {/* AirPlus is the storefront's live price — it sells from this column. */}
            <tr className="on">
              <td>AirPlus</td>
              <td>
                <input
                  value={form.onlineThb}
                  onChange={(e) => update({ onlineThb: e.target.value })}
                  style={numStyle}
                />
              </td>
              <td className="muted">—</td>
              <td>
                <Profit value={onlineProfit} show={online > 0} />
              </td>
              <td>
                <MarginBar profit={onlineProfit} price={online} />
              </td>
            </tr>
            {/* AC on Sales = the Shopee shop. No API, so this is a reference the owner keeps by
                hand — and the marketplace commission belongs here. */}
            <tr>
              <td>AC on Sales</td>
              <td>
                <input
                  value={form.shopeeThb}
                  onChange={(e) => update({ shopeeThb: e.target.value })}
                  style={numStyle}
                />
              </td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <input
                    value={form.onlineCommPct}
                    onChange={(e) => update({ onlineCommPct: e.target.value })}
                    style={{ ...inputS, width: 56 }}
                  />
                  <span className="muted">%</span>
                </span>
              </td>
              <td>
                <Profit value={shopeeProfit} show={shopee > 0} />
              </td>
              <td>
                <MarginBar profit={shopeeProfit} price={shopee} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
