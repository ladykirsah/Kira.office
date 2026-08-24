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
  // Archived first: it is the one state you cannot get back to from the product page, so it must
  // never be softened into "Paused". Inside the merged "Not live" tab the pill is the only thing
  // left distinguishing a product you chose to hide from one that was deleted.
  if (p.status === "archived") return { label: "Archived", cls: "bad" };
  if (p.status === "draft") return { label: "Draft", cls: "off" };
  if (p.status !== "active") return { label: "Paused", cls: "pause" };
  return { label: "Active", cls: "on" };
}

/**
 * Is this product NOT in front of customers?
 *
 * Backs the merged "Not live" tab (owner, 2026-08-24), which replaced three separate tabs — Paused,
 * Draft and Archive — because from the shop's point of view they answer one question:
 *
 *   draft    — not live, and not finished being written
 *   paused   — not live, deliberately
 *   archived — not live, because it was deleted
 *
 * Only `active` is live. Anything unrecognised counts as not live: the default has to be "not in
 * front of customers", because the opposite default publishes something by accident.
 */
export function isNotLive(status: string): boolean {
  return status !== "active";
}
