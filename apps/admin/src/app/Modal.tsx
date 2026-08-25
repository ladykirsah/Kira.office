"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useT } from "./LangProvider";

/**
 * A centred overlay for a "View" popup. Closes on backdrop click, the ✕, or Escape.
 *
 * Lives at the app root rather than inside the order route: the order Documents card established
 * this as the way evidence is viewed, and wage slips on a staff profile now use the very same one
 * (owner, 2026-08-04). `orders/[id]/docKit` re-exports it, so its own imports still read locally.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
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
          {/* The order card's `sectionTitle`, copied value-for-value so this file stays free of
              route imports while the popup keeps looking identical on both pages. */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            {title}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t({ th: "ปิด", en: "Close" })}
            title={t({ th: "ปิด", en: "Close" })}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
