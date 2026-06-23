"use client";

import { useState } from "react";
import { computeSaleProfit, suggestPriceForTargetMargin } from "@l-shopee/core";

const baht = (n: number) => `฿${n.toFixed(2)}`;
const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0);
const field = { display: "grid", gap: 4 } as const;

export default function PricingPage() {
  const [costThb, setCostThb] = useState("60");
  const [priceThb, setPriceThb] = useState("107");
  const [vatPct, setVatPct] = useState("7");
  const [inclusive, setInclusive] = useState(true);
  const [commissionPct, setCommissionPct] = useState("8");
  const [marginPct, setMarginPct] = useState("40");

  const cost = num(costThb);
  const price = num(priceThb);
  const vatRate = num(vatPct) / 100;
  const commissionRate = num(commissionPct) / 100;

  const base = {
    unitPrice: price,
    quantity: 1,
    vatRate,
    priceIncludesVat: inclusive,
    landedUnitCost: cost,
  } as const;
  const onsite = computeSaleProfit({ ...base, channel: "onsite" });
  const online = computeSaleProfit({ ...base, channel: "online", fees: { commissionRate } });

  let suggestion: { onsite: number; online: number } | null = null;
  let suggestErr = "";
  try {
    suggestion = {
      onsite: suggestPriceForTargetMargin({
        landedUnitCost: cost,
        targetMarginPct: num(marginPct),
        vatRate,
        priceIncludesVat: inclusive,
        channel: "onsite",
      }).unitPrice,
      online: suggestPriceForTargetMargin({
        landedUnitCost: cost,
        targetMarginPct: num(marginPct),
        vatRate,
        priceIncludesVat: inclusive,
        channel: "online",
        fees: { commissionRate },
      }).unitPrice,
    };
  } catch (e) {
    suggestErr = (e as Error).message;
  }

  const row = (label: string, p: typeof onsite) => (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td>{label}</td>
      <td align="right">{baht(p.salesExTax)}</td>
      <td align="right">{baht(p.taxAmount)}</td>
      <td align="right">{baht(p.marketplaceFee)}</td>
      <td align="right">{baht(p.landedCost)}</td>
      <td align="right">
        <strong>{baht(p.grossProfit)}</strong>
      </td>
      <td align="right">{p.grossMarginPct.toFixed(1)}%</td>
    </tr>
  );

  return (
    <main>
      <h1>Pricing calculator</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <label style={field}>
          Cost (THB)
          <input
            value={costThb}
            onChange={(e) => setCostThb(e.target.value)}
            style={{ width: 90 }}
          />
        </label>
        <label style={field}>
          Sell price (THB)
          <input
            value={priceThb}
            onChange={(e) => setPriceThb(e.target.value)}
            style={{ width: 90 }}
          />
        </label>
        <label style={field}>
          VAT %
          <input value={vatPct} onChange={(e) => setVatPct(e.target.value)} style={{ width: 60 }} />
        </label>
        <label style={field}>
          Shopee commission %
          <input
            value={commissionPct}
            onChange={(e) => setCommissionPct(e.target.value)}
            style={{ width: 70 }}
          />
        </label>
        <label style={{ ...field, alignSelf: "end" }}>
          <span>
            <input
              type="checkbox"
              checked={inclusive}
              onChange={(e) => setInclusive(e.target.checked)}
            />{" "}
            price includes VAT
          </span>
        </label>
      </div>

      <table cellPadding={6} style={{ borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            <th align="left">Channel</th>
            <th align="right">Rev ex-VAT</th>
            <th align="right">VAT</th>
            <th align="right">Fee</th>
            <th align="right">Cost</th>
            <th align="right">Profit</th>
            <th align="right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {row("On-site", onsite)}
          {row("Online (Shopee)", online)}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Suggested price for target margin</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={field}>
          Target margin %
          <input
            value={marginPct}
            onChange={(e) => setMarginPct(e.target.value)}
            style={{ width: 70 }}
          />
        </label>
      </div>
      {suggestion ? (
        <p>
          On-site: <strong>{baht(suggestion.onsite)}</strong> · Online (Shopee):{" "}
          <strong>{baht(suggestion.online)}</strong>
        </p>
      ) : (
        <p style={{ color: "var(--danger)" }}>{suggestErr}</p>
      )}
    </main>
  );
}
