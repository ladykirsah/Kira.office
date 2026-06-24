"use client";

import { useState } from "react";
import { formatBahtTrim } from "@/lib/format";

/**
 * One price tier in the products table: the price with a press-and-hold eye that reveals its profit
 * underneath (keeps margins off-screen at a glance — same pattern as ProfitPeek).
 */
export function PriceProfitCell({
  priceSatang,
  profitSatang,
}: {
  priceSatang: number;
  profitSatang: number;
}) {
  const [show, setShow] = useState(false);
  const hide = () => setShow(false);

  if (!priceSatang) return <span className="muted">—</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontWeight: 600 }}>{formatBahtTrim(priceSatang)}</span>
        <button
          type="button"
          aria-label="Hold to reveal profit"
          title="Hold to see profit"
          onPointerDown={() => setShow(true)}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            minHeight: 0,
            padding: "2px 6px",
            lineHeight: 1,
            cursor: "pointer",
            touchAction: "none",
            userSelect: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </span>
      <span style={{ fontSize: 12, minHeight: 15 }}>
        {show ? (
          <strong style={{ color: profitSatang >= 0 ? "var(--ok)" : "var(--danger)" }}>
            profit {formatBahtTrim(profitSatang)}
          </strong>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>hold to see profit</span>
        )}
      </span>
    </div>
  );
}
