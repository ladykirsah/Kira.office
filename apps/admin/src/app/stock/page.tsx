"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStock,
  fetchStockMovements,
  adjustStock,
  type StockRow,
  type StockMovementRow,
} from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import {
  stockStatus,
  movementLabel,
  planAdjustment,
  type StockStatus,
  type AdjustAction,
} from "@/lib/stock";
import { useToast } from "../ToastProvider";

const ACTIONS: { key: AdjustAction; label: string; amountLabel: string }[] = [
  { key: "receive", label: "Receive", amountLabel: "Qty in" },
  { key: "write_off", label: "Write-off", amountLabel: "Qty out" },
  { key: "correction", label: "Correct to", amountLabel: "Counted" },
];

const card = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
} as const;

const right = { textAlign: "right" } as const;

const STATUS_PILL: Record<StockStatus, string> = { out: "bad", low: "warn", ok: "good" };
const STATUS_LABEL: Record<StockStatus, string> = { out: "Out", low: "Low", ok: "OK" };

export default function StockPage() {
  const [stock, setStock] = useState<StockRow[] | null>(null);
  const [movements, setMovements] = useState<StockMovementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | StockStatus>("all");
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

  const counts = useMemo(() => {
    const rows = stock ?? [];
    let low = 0;
    let out = 0;
    for (const r of rows) {
      const st = stockStatus(r.onHand);
      if (st === "out") out += 1;
      else if (st === "low") low += 1;
    }
    return { total: rows.length, low, out };
  }, [stock]);

  if (error) {
    return (
      <main>
        <h1>Stock</h1>
        <p style={{ color: "var(--danger)" }}>Could not load stock: {error}</p>
      </main>
    );
  }

  const rows = (stock ?? []).filter((r) => filter === "all" || stockStatus(r.onHand) === filter);

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div style={card}>
      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );

  const Section = ({ title, stat }: { title: string; stat: string }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        borderTop: "1px solid var(--border)",
        paddingTop: 18,
        marginTop: 26,
        marginBottom: 14,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      <span className="muted" style={{ fontSize: 12 }}>
        {stat}
      </span>
    </div>
  );

  return (
    <main>
      <h1>Stock</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        On-hand across all variants, derived from the movement ledger.
      </p>

      {stock === null ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Card label="Variants" value={String(counts.total)} />
            <Card label="Low stock" value={String(counts.low)} />
            <Card label="Out of stock" value={String(counts.out)} />
          </div>

          <Section title="On hand" stat={`${rows.length} shown`} />

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 14,
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
                {(stock ?? []).map((r) => (
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
                {ACTIONS.find((a) => a.key === adjAction)?.amountLabel ?? "Amount"}
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

          <div className="card" style={{ overflowX: "auto" }}>
            <div style={{ marginBottom: 12 }}>
              <label>
                Show{" "}
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as "all" | StockStatus)}
                  style={inputS}
                >
                  <option value="all">all</option>
                  <option value="low">low</option>
                  <option value="out">out of stock</option>
                  <option value="ok">in stock</option>
                </select>
              </label>
            </div>
            {rows.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📦</div>
                {(stock ?? []).length === 0 ? "No variants yet." : "No matching variants."}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={right}>On hand</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = stockStatus(r.onHand);
                    return (
                      <tr key={r.variantId}>
                        <td>{r.productName}</td>
                        <td style={{ fontFamily: "var(--font-mono, monospace)" }}>
                          {r.sku ?? <span className="muted">—</span>}
                        </td>
                        <td style={right}>{r.onHand}</td>
                        <td>
                          <span className={`pill ${STATUS_PILL[st]}`}>{STATUS_LABEL[st]}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Section
            title="Recent movements"
            stat={movements === null ? "" : `${movements.length} entries`}
          />
          {movements === null ? (
            <div className="skeleton skeleton-row" style={{ width: "50%" }} />
          ) : movements.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>No stock movements yet.
            </div>
          ) : (
            <div className="card" style={{ overflowX: "auto" }}>
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
                            className="muted"
                            style={{
                              fontFamily: "var(--font-mono, monospace)",
                              fontSize: 12,
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
            </div>
          )}
        </>
      )}
    </main>
  );
}
