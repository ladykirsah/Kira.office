"use client";

import { useState } from "react";
import { useT } from "./LangProvider";
import type { Phrase } from "@/lib/lang";

const PRODUCT_ID: Phrase = { th: "รหัสสินค้า", en: "Product ID" };
import { markShopeeSynced, type ShopeeWorklistItem } from "@/lib/api";
import { CopyButton } from "./products/CopyButton";
import { tableText } from "@/lib/tableText";

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

// Padding lives in `.wl-cell` (globals.css) rather than here, because a phone needs a different
// value and an inline style cannot be overridden by a media query. 3px on a wide screen, where a
// row is one line and the owner asked for many rows on screen; 6px on a phone, where a row carries
// the Product ID under the name and the pairs would otherwise run together.

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

  const t = useT();
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
      setError(
        (e as Error).message ||
          t({ th: "ล้างรายการไม่สำเร็จ ลองอีกครั้ง", en: "Could not clear. Try again." }),
      );
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">✓</div>
        {t({ th: "ไม่มีรายการต้องอัปเดต", en: "No updates." })}
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th className="wl-cell">{t({ th: "สินค้า", en: "Product" })}</th>
              {/* ON A PHONE ONLY, the Product ID moves UNDER the name and this column disappears
                  (owner, 27 Aug 2026). As two columns they cost the table more width than a phone
                  has — 312px of table inside a 286px panel at 320px wide — so the list scrolled
                  sideways to read a code that belongs to the name beside it, and every name wrapped
                  over two or three lines to make room. A wide screen has the width and keeps them
                  side by side. */}
              <th className="wl-cell wl-id-col">{t(PRODUCT_ID)}</th>
              <th className="wl-cell" style={{ textAlign: "right" }}>
                {t({ th: "ลดลง", en: "Reduce" })}
              </th>
              <th className="wl-cell" style={{ textAlign: "center", width: 60 }}>
                {t({ th: "เสร็จ", en: "Done" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isDone = done.has(r.productId);
              return (
                <tr key={r.productId} style={isDone ? { opacity: 0.5 } : undefined}>
                  <td className="wl-cell">
                    {/* Only the NAME is struck through when a row is ticked. Striking the code too
                        would put a line through the very thing you are about to copy. */}
                    <div
                      style={{
                        fontWeight: 600,
                        textDecoration: isDone ? "line-through" : undefined,
                      }}
                    >
                      {r.name}
                    </div>
                    {/* The same code as the column to the right, and only ever one of the two is
                        on screen — see the header. */}
                    <span className="wl-id-inline" style={tableText.subtitle}>
                      {r.productRef}
                      <CopyButton value={r.productRef} label={`${t(PRODUCT_ID)} ${r.productRef}`} />
                    </span>
                  </td>
                  <td className="wl-cell wl-id-col">
                    <span style={idCell}>
                      {r.productRef}
                      <CopyButton value={r.productRef} label={`${t(PRODUCT_ID)} ${r.productRef}`} />
                    </span>
                  </td>
                  <td
                    className="wl-cell"
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: r.deltaSinceSync < 0 ? "var(--danger)" : "var(--ok)",
                    }}
                  >
                    {reduceLabel(r.deltaSinceSync)}
                  </td>
                  <td className="wl-cell" style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggle(r.productId)}
                      aria-label={t({
                        th: `ทำเครื่องหมายว่า ${r.name} เสร็จแล้ว`,
                        en: `Mark ${r.name} done`,
                      })}
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
            t({
              th: `ทำแล้ว ${doneCount} จาก ${rows.length} รายการ`,
              en: `${doneCount} of ${rows.length} marked done`,
            })
          )}
        </span>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={clearDone}
          disabled={busy || doneCount === 0}
        >
          {busy
            ? t({ th: "กำลังล้าง…", en: "Clearing…" })
            : t({ th: `ล้างที่เสร็จแล้ว (${doneCount})`, en: `Clear done (${doneCount})` })}
        </button>
      </div>
    </div>
  );
}
