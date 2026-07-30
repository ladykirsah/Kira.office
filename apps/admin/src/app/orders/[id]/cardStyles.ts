/**
 * The card chrome the /orders/:id sections share.
 *
 * Extracted so OrderDetailView and the shipment section cannot drift apart — they sit next to each
 * other on the page, and a card with a different radius or padding reads as a bug. Kept in its own
 * module rather than exported from OrderDetailView, which would make the import circular.
 */

export const card = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  background: "var(--surface)",
  marginBottom: 16,
} as const;

export const sectionTitle = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-muted)",
  marginBottom: 10,
} as const;
