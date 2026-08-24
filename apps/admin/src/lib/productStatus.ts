import type { ProductRow } from "./api";
import { stockStatus } from "./stock";

export interface StatusTag {
  label: string;
  /** pill modifier class — see `.pill.*` in globals.css */
  cls: "on" | "off" | "pause" | "warn" | "bad";
}

/**
 * The single word in the products table's "Status" column (owner, 2026-08-24).
 *
 * Renamed from "AirPlus" and now mirroring the tabs, so a row's status tells you which tab it would
 * be found under: Live · Low · Out · Paused · Draft · Archived.
 *
 * A product can qualify for two at once — live AND out of stock — and there is one pill, so the
 * ORDER is the design:
 *
 *   1. Not live at all (Draft → Paused). If customers cannot see it, its stock level is not the
 *      thing worth saying about it.
 *   2. Out, then Low. It IS live, so stock is now the most urgent fact.
 *   3. Live. Nothing to flag.
 *
 * This reverses the 2 Aug 2026 decision that folded "Out" into Active on the grounds that stock had
 * its own column; the owner asked for this column to mirror the tabs instead. The stock NUMBER is
 * still its own column — this is the flag, not the figure.
 */
export function productStatusTag(p: Pick<ProductRow, "status" | "onHand">): StatusTag {
  // Three states since 2026-08-24: active, draft, paused. "archived" was retired into paused
  // (migration 0088) — anything not active and not draft reads Paused, including a stale row.
  if (p.status === "draft") return { label: "Draft", cls: "off" };
  if (p.status !== "active") return { label: "Paused", cls: "pause" };

  const stock = stockStatus(p.onHand);
  if (stock === "out") return { label: "Out", cls: "bad" };
  if (stock === "low") return { label: "Low", cls: "warn" };
  return { label: "Live", cls: "on" };
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
