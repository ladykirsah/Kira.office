import type { CSSProperties } from "react";

/**
 * Input-box size patterns — the shared vocabulary used when describing the UI.
 *
 *   inputL — "L input box": full default height (40px); for primary fields (date, license plate).
 *            Matches the default (L) button height (40px) so they line up on a row.
 *   inputS — "S input box": compact height (32px); for dense/secondary controls
 *            (selects, scan boxes, inline add-item, pricing-table cells).
 *            minHeight:32 floors it to match .btn-sm / .btn-soft (32px); the base input
 *            min-height is 40px, so without this floor an S input renders ~30.5px and sits
 *            1.5px shorter than an S button beside it.
 *
 * Spread these into a field's style and add width/flex as needed:
 *   style={{ ...inputS, width: "min(110px, 100%)" }}
 */
export const inputL: CSSProperties = { width: "100%" };
export const inputS: CSSProperties = { minHeight: 32, padding: "6px 10px" };
