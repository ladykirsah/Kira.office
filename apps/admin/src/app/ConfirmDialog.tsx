"use client";

import { useEffect, type ReactNode } from "react";

/**
 * A small modal confirm for a warning-gated action — used when the outcome (and its message) is
 * only known mid-action, so the inline {@link ConfirmButton} can't carry it. Example: a delete the
 * API refuses with "N products still use this", where the admin must see N before confirming.
 *
 * No `window.confirm` (the app deliberately avoids it). Backdrop click and Escape cancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
      >
        {title && <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>}
        <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn-sm"
            onClick={onCancel}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              cursor: "pointer",
              padding: "6px 12px",
            }}
          >
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger btn-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
