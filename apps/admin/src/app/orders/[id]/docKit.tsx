"use client";

import { type ReactNode } from "react";
import { tableText } from "@/lib/tableText";

// The popup moved to the app root so the staff wage slips can use the very same one; re-exported
// here because this is where the order Documents card expects to find it.
export { Modal } from "../../Modal";

/**
 * Small building blocks for the order Documents section. Kept free of any data/API imports so both
 * the Documents card and the label export (in ShipmentActions) can share them without a cycle.
 */

/** One file row: name (+ optional sub-line) on the left, its actions on the right. */
export function DocRow({
  label,
  sub,
  actions,
  first,
}: {
  label: string;
  sub?: string;
  actions?: ReactNode;
  /** The first row skips the divider that separates rows. */
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderTop: first ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ ...tableText.body2, fontWeight: 600 }}>{label}</div>
        {sub && <div style={tableText.subtitle}>{sub}</div>}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* Hairline before the row's actions — same separator as the Services table. */}
          <span
            aria-hidden="true"
            style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 4px" }}
          />
          {actions}
        </div>
      )}
    </div>
  );
}
