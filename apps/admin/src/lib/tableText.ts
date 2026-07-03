import type { CSSProperties } from "react";

/**
 * Canonical table text roles — use across every table so cell typography stays consistent.
 *   headline → the column header (`<th>`): 12px / 600 / muted, handled by the base `th` CSS.
 *   body1    → the primary cell value (main number or name): 16px, the base `<td>` default.
 *   body2    → a secondary line inside a cell (e.g. a date above its time): 14px.
 *   subtitle → a caption line inside a cell (e.g. the time under a date): 12px, faint.
 */
export const tableText = {
  body1: { fontSize: 16 },
  body2: { fontSize: 14 },
  subtitle: { fontSize: 12, color: "var(--text-faint)" },
} satisfies Record<string, CSSProperties>;
