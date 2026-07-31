"use client";

import { useEffect, type ReactNode } from "react";
import { tableText } from "@/lib/tableText";
import { sectionTitle } from "./cardStyles";
import { Icon } from "../../Icon";

/**
 * Small building blocks for the order Documents section. Kept free of any data/API imports so both
 * the Documents card and the label export (in ShipmentActions) can share them without a cycle.
 */

/** A centred overlay for a "View" popup. Closes on backdrop click, the ✕, or Escape. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          maxWidth: "min(92vw, 640px)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={sectionTitle}>{title}</div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
