import type { ReactNode } from "react";

/**
 * Flat white frame for a data table — border + radius + surface fill (no shadow), with an
 * inner horizontal-scroll wrapper. The one wrapper used around every page-level table so they
 * look identical everywhere.
 */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface)",
        padding: 18,
      }}
    >
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}
