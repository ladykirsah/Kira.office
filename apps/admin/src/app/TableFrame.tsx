import type { ReactNode } from "react";

/**
 * Flat white frame for a data table — border + radius + surface fill (no shadow), with an
 * inner horizontal-scroll wrapper. The one wrapper used around every page-level table so they
 * look identical everywhere.
 */
/**
 * `cards` opts the inner scroller into the phone card layout: it swaps the inline `overflowX` for
 * `.list-cards-scroll`, which the media query can reach and an inline style never could. Opt-in,
 * because a table inside this frame that has NOT labelled its cells must keep its sideways scroll
 * — a card of unexplained values is worse than a scrollbar. See conventions/admin-locked-patterns.
 */
export function TableFrame({ children, cards }: { children: ReactNode; cards?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface)",
        padding: 18,
      }}
    >
      {cards ? (
        <div className="list-cards-scroll">{children}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>{children}</div>
      )}
    </div>
  );
}
