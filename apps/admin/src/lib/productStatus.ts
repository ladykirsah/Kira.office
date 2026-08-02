import type { ProductRow } from "./api";

export interface StatusTag {
  label: string;
  /** pill modifier class — see `.pill.*` in globals.css */
  cls: "on" | "off" | "pause" | "bad";
}

/**
 * Single display status for a product's presence on AIRPLUS, the owner's own storefront — the column
 * is headed "AirPlus". It mirrors the `status` field directly, in three states (first match wins):
 *   Draft   — not published yet (status === "draft")
 *   Paused  — deliberately hidden from the storefront (any status that is neither active nor draft)
 *   Active  — live on AirPlus
 * Stock is a separate column, so an active product reads Active whether or not it has stock right now
 * (owner, 2 Aug 2026 — the old "Out" state folded into Active). shopeeListed is legacy and unread:
 * there is no Shopee API (owner, 2026-07-29).
 */
export function productStatusTag(p: Pick<ProductRow, "status">): StatusTag {
  if (p.status === "draft") return { label: "Draft", cls: "off" };
  if (p.status !== "active") return { label: "Paused", cls: "pause" };
  return { label: "Active", cls: "on" };
}
