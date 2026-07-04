"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchStock,
  fetchStockMovements,
  adjustStock,
  type StockRow,
  type StockMovementRow,
} from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { movementLabel, planAdjustment, type AdjustAction } from "@/lib/stock";
import { tableText } from "@/lib/tableText";
import { PageHeader } from "../PageHeader";
import { TableFrame } from "../TableFrame";
import { useToast } from "../ToastProvider";

const right = { textAlign: "right" } as const;

const ACTIONS: { key: AdjustAction; label: string; amountLabel: string }[] = [
  { key: "receive", label: "Receive", amountLabel: "Qty in" },
  { key: "write_off", label: "Write-off", amountLabel: "Qty out" },
  { key: "correction", label: "Correct to", amountLabel: "Counted" },
];

export default function StockMovementsPage() {
  const [stock, setStock] = useState<StockRow[] | null>(null);
  const [movements, setMovements] = useState<StockMovementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [adjVariant, setAdjVariant] = useState("");
  const [adjAction, setAdjAction] = useState<AdjustAction>("receive");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);

  const load = useCallback(() => {
    fetchStock()
      .then(setStock)
      .catch((err) => setError((err as Error).message));
    fetchStockMovements()
      .then(setMovements)
      .catch(() => setMovements([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function applyAdjustment() {
    const variant = (stock ?? []).find((r) => r.variantId === adjVariant);
    const amount = Math.round(parseFloat(adjAmount));
    if (!variant || !Number.isFinite(amount)) {
      toast("Pick a product and enter a number", "error");
      return;
    }
    const plan = planAdjustment(adjAction, amount, variant.onHand);
    if (plan.quantityDelta === 0) {
      toast("No change — on-hand already matches", "info");
      return;
    }
    setAdjBusy(true);
    try {
      const res = await adjustStock({
        productVariantId: variant.variantId,
        quantityDelta: plan.quantityDelta,
        movementType: plan.movementType,
        reason: adjNote.trim() || undefined,
      });
      if (res.applied) {
        toast(`${variant.productName} → ${res.quantityAfter} on hand`, "success");
        setAdjAmount("");
        setAdjNote("");
        load();
      } else {
        toast(res.reason ?? "Adjustment rejected", "error");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdjBusy(false);
    }
  }

  if (error) {
    return (
      <main>
        <h1>Stock movements</h1>
        <p style={{ color: "var(--danger)" }}>Could not load stock: {error}</p>
      </main>
    );
  }

  const amountLabel = ACTIONS.find((a) => a.key === adjAction)?.amountLabel ?? "Amount";

  return (
    <main>
      <PageHeader
        title="Stock movements"
        subtitle={
          <>
            Receive stock, write off damage, or correct a count — every change is logged below.
            Current on-hand per product lives on <a href="/products">Products</a>.
          </>
        }
      />

      {stock === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 20,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Product
            </span>
            <select
              value={adjVariant}
              onChange={(e) => setAdjVariant(e.target.value)}
              style={{ ...inputS, minWidth: 220 }}
            >
              <option value="">Select…</option>
              {stock.map((r) => (
                <option key={r.variantId} value={r.variantId}>
                  {r.productName}
                  {r.sku ? ` · ${r.sku}` : ""} ({r.onHand})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Action
            </span>
            <select
              value={adjAction}
              onChange={(e) => setAdjAction(e.target.value as AdjustAction)}
              style={inputS}
            >
              {ACTIONS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {amountLabel}
            </span>
            <input
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              inputMode="numeric"
              aria-label="Adjustment amount"
              style={{ ...inputS, width: 90 }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, flex: "1 1 160px" }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Note (optional)
            </span>
            <input
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              placeholder="e.g. supplier delivery"
              style={{ ...inputS, width: "100%" }}
            />
          </label>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={adjBusy}
            onClick={applyAdjustment}
          >
            {adjBusy ? "Applying…" : "Apply"}
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          borderTop: "1px solid var(--border)",
          paddingTop: 18,
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>History</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {movements === null ? "" : `${movements.length} entries`}
        </span>
      </div>

      {movements === null ? (
        <div className="skeleton skeleton-row" style={{ width: "50%" }} />
      ) : movements.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🧾</div>No stock movements yet.
        </div>
      ) : (
        <TableFrame>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Movement</th>
                <th style={right}>Qty</th>
                <th style={right}>On hand</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatUpdatedAt(m.createdAt)}</td>
                  <td>
                    {m.productName}
                    {m.sku && (
                      <span
                        style={{
                          ...tableText.subtitle,
                          fontFamily: "var(--font-mono, monospace)",
                          marginLeft: 6,
                        }}
                      >
                        {m.sku}
                      </span>
                    )}
                  </td>
                  <td>{movementLabel(m.movementType)}</td>
                  <td
                    style={{
                      ...right,
                      color: m.quantityDelta < 0 ? "var(--danger)" : "var(--ok)",
                      fontWeight: 600,
                    }}
                  >
                    {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                  </td>
                  <td style={right}>{m.quantityAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}
    </main>
  );
}
