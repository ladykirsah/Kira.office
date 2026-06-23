"use client";

import { useEffect, useState } from "react";
import { fetchStock, adjustStock, type StockRow } from "@/lib/api";
import { useToast } from "../ToastProvider";

export default function StockPage() {
  const toast = useToast();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [variantId, setVariantId] = useState("");
  const [delta, setDelta] = useState("");
  const [movementType, setMovementType] = useState("receive");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const s = await fetchStock();
      setRows(s);
      if (!variantId && s[0]) setVariantId(s[0].variantId);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply() {
    const quantityDelta = parseInt(delta, 10);
    if (!variantId || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
      toast("Pick a product and a non-zero quantity.", "error");
      return;
    }
    setBusy(true);
    try {
      const out = await adjustStock({
        productVariantId: variantId,
        quantityDelta,
        movementType,
        reason,
      });
      if (out.applied) {
        toast(`Done — on hand is now ${out.quantityAfter}`, "success");
        setDelta("");
        setReason("");
        await load();
      } else {
        toast(`Rejected: ${out.reason ?? "not applied"}`, "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main>
        <h1>Stock</h1>
        <div className="skeleton skeleton-row" style={{ width: "40%" }} />
        <div className="skeleton skeleton-row" style={{ width: "90%" }} />
        <div className="skeleton skeleton-row" style={{ width: "75%" }} />
      </main>
    );

  return (
    <main>
      <h1>Stock</h1>
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          Product
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {rows.map((r) => (
              <option key={r.variantId} value={r.variantId}>
                {r.productName} ({r.productCode}) — {r.onHand}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Qty (+/−)
          <input value={delta} onChange={(e) => setDelta(e.target.value)} style={{ width: 80 }} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Type
          <select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
            <option value="receive">receive</option>
            <option value="correction">correction</option>
            <option value="write_off">write off</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button className="btn-primary" onClick={apply} disabled={busy}>
          Apply
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>No stock yet. Add products first.
        </div>
      ) : (
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Code</th>
              <th align="left">SKU</th>
              <th align="right">On hand</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variantId} style={{ borderTop: "1px solid var(--border)" }}>
                <td>{r.productName}</td>
                <td>{r.productCode}</td>
                <td>{r.sku ?? "—"}</td>
                <td align="right">{r.onHand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
