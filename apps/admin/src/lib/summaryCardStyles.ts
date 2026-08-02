import type { CSSProperties } from "react";

/**
 * The look of one summary-frame card, shared so the /orders table and the dashboard render the frame
 * identically — same box, same label, same number colouring. Lifted out of OrdersTable when the
 * dashboard began duplicating the frame (owner, 2 Aug 2026): one copy of the style is what keeps the
 * two frames from drifting apart.
 */
export const summaryCard: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "12px 14px",
  cursor: "pointer",
  transition: "border-color 0.15s",
};

/** The card while its filter is on — a coral outline over a faint coral wash. */
export const summaryCardActive: CSSProperties = {
  ...summaryCard,
  borderColor: "var(--primary)",
  background: "var(--primary-faint)",
};

/** The small uppercase section name above the number. */
export const summaryLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

/** The count itself — colour is applied per-card, see summaryNumberColor. */
export const summaryNumber: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginTop: 2,
  fontVariantNumeric: "tabular-nums",
};

/**
 * A non-zero count wears the card's colour; zero reads faint. Nothing is waiting, so nothing should
 * shout — the same rule the Status column follows by colouring only the states that need an action.
 */
export function summaryNumberColor(value: number, activeColor: string): string {
  return value > 0 ? activeColor : "var(--text-faint)";
}
