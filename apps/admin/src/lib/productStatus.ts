import type { ProductRow } from "./api";

export interface StatusTag {
  label: string;
  /** pill modifier class — see `.pill.*` in globals.css */
  cls: "on" | "off" | "pause" | "bad";
}

/**
 * Single display status for a product row. Precedence (first match wins):
 *   Draft  — not published yet (status === "draft")
 *   Pause  — active but pulled from Shopee (deliberately not listed)
 *   Out    — listed on Shopee but no stock (live and unfulfillable)
 *   Active — listed and in stock
 */
export function productStatusTag(
  p: Pick<ProductRow, "status" | "shopeeListed" | "onHand">,
): StatusTag {
  if (p.status === "draft") return { label: "Draft", cls: "off" };
  if (!p.shopeeListed) return { label: "Pause", cls: "pause" };
  if (p.onHand <= 0) return { label: "Out", cls: "bad" };
  return { label: "Active", cls: "on" };
}
