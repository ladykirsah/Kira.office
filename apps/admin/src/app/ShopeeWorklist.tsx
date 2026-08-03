"use client";

import { useState } from "react";
import { markShopeeSynced, type ShopeeWorklistItem } from "@/lib/api";
import { CopyButton } from "./products/CopyButton";

/** −3 for a reduction, +2 for a restock. Uses a real minus sign to match the status-tag look. */
function reduceLabel(delta: number): string {
  return delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`;
}

const panelStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  overflow: "hidden",
} as const;

const footStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 12px",
  borderTop: "1px solid var(--border)",
} as const;

const idCell = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
} as const;

// The global table cell is padded 12px all round — too tall for a scan-and-tick list. Tighten the
// vertical padding to 3px (owner's pick) so many rows fit on screen; keep 12px sides for breathing room.
const cellPad = { padding: "3px 12px" } as const;

/**
 * The dashboard "Update on Shopee" checklist (Design A). The server hands in the products whose stock
 * moved since they were last reconciled on Shopee; the owner ticks the ones they've updated there and
 * hits Clear, which stamps them synced (so they drop off and stay off) and removes them from the view.
 */
export function ShopeeWorklist({ rows: initial }: { rows: ShopeeWorklistItem[] }) {
  const [rows, setRows] = useState(initial);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doneCount = rows.reduce((n, r) => n + (done.has(r.productId) ? 1 : 0), 0);

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearDone() {
    const ids = rows.filter((r) => done.has(r.productId)).map((r) => r.productId);
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await markShopeeSynced(ids);
      setRows((prev) => prev.filter((r) => !done.has(r.productId)));
      setDone(new Set());
    } catch (e) {
      // Keep the ticks so the owner can retry — the Shopee stock wasn't cleared on our side.
      setError((e as Error).message || "Could not clear. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">✓</div>
        No updates.
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={cellPad}>Product</th>
              <th style={cellPad}>Product ID</th>
              <th style={{ ...cellPad, textAlign: "right" }}>Reduce</th>
              <th style={{ ...cellPad, textAlign: "center", width: 60 }}>Done</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isDone = done.has(r.productId);
              return (
                <tr key={r.productId} style={isDone ? { opacity: 0.5 } : undefined}>
                  <td
                    style={{
                      ...cellPad,
                      fontWeight: 600,
                      textDecoration: isDone ? "line-through" : undefined,
                    }}
                  >
                    {r.name}
                  </td>
                  <td style={cellPad}>
                    <span style={idCell}>
                      {r.productRef}
                      <CopyButton value={r.productRef} label={`Product ID ${r.productRef}`} />
                    </span>
                  </td>
                  <td
                    style={{
                      ...cellPad,
                      textAlign: "right",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: r.deltaSinceSync < 0 ? "var(--danger)" : "var(--ok)",
                    }}
                  >
                    {reduceLabel(r.deltaSinceSync)}
                  </td>
                  <td style={{ ...cellPad, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggle(r.productId)}
                      aria-label={`Mark ${r.name} done`}
                      style={{
                        width: 17,
                        height: 17,
                        accentColor: "var(--primary)",
                        cursor: "pointer",
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={footStyle}>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {error ? (
            <span style={{ color: "var(--danger)" }}>{error}</span>
          ) : (
            `${doneCount} of ${rows.length} marked done`
          )}
        </span>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={clearDone}
          disabled={busy || doneCount === 0}
        >
          {busy ? "Clearing…" : `Clear done (${doneCount})`}
        </button>
      </div>
    </div>
  );
}
