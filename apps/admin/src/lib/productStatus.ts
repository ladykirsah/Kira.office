import type { ProductRow } from "./api";

export interface StatusTag {
  label: string;
  /** pill modifier class — see `.pill.*` in globals.css */
  cls: "on" | "off" | "pause" | "bad";
}

/**
 * Single display status for a product row — it describes AIRPLUS, the owner's own storefront, which
 * shows a product only while status = 'active' (owner, 2026-07-29: there is no Shopee API, so the
 * old shopeeListed flag no longer decides anything). Precedence (first match wins):
 *   Draft      — not published yet (status === "draft")
 *   Paused     — deliberately hidden from the storefront
 *   Out        — live on AirPlus but no stock (visible and unfulfillable)
 *   On AirPlus — live and in stock
 */
export function productStatusTag(
  p: Pick<ProductRow, "status" | "shopeeListed" | "onHand">,
): StatusTag {
  if (p.status === "draft") return { label: "Draft", cls: "off" };
  if (p.status !== "active") return { label: "Paused", cls: "pause" };
  if (p.onHand <= 0) return { label: "Out", cls: "bad" };
  return { label: "On AirPlus", cls: "on" };
}
