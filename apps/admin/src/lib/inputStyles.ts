import type { CSSProperties } from "react";

/**
 * Input-box size patterns — the shared vocabulary used when describing the UI.
 *
 *   inputL — "L input box": 40px tall; for primary fields (product name, date, license plate).
 *   inputS — "S input box": compact ~36px; for dense/secondary controls
 *            (selects, scan boxes, inline add-item, pricing-table cells).
 *
 * Spread these into a field's style and add width/flex as needed:
 *   style={{ ...inputS, width: "min(110px, 100%)" }}
 */
export const inputL: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 40,
  height: 40,
};
export const inputS: CSSProperties = { minHeight: 0, padding: "8px 10px" };
