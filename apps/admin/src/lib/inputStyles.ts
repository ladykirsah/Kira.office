import type { CSSProperties } from "react";

/**
 * Input-box size patterns — the shared vocabulary used when describing the UI.
 *
 *   inputL — "L input box": full default height; for primary fields (date, license plate).
 *   inputS — "S input box": compact height; for dense/secondary controls
 *            (selects, scan boxes, inline add-item, pricing-table cells).
 *
 * Spread these into a field's style and add width/flex as needed:
 *   style={{ ...inputS, width: "min(110px, 100%)" }}
 */
export const inputL: CSSProperties = { width: "100%" };
export const inputS: CSSProperties = { minHeight: 0, padding: "8px 10px" };
