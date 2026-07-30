// Maps sale/order/payment statuses to the themed `.pill` variants in globals.css, plus a couple
// of label helpers. Pure + unit-tested so the tables can render consistent, dark-mode-aware badges.

import { operationalStatus, operationalStatusLabel } from "@l-shopee/core";

export type PillClass = "good" | "warn" | "bad" | "off" | "soft" | "info";

/** A completed sale is good; a refunded one is muted; anything mid-flight is amber. */
export function saleStatusPill(status: string): PillClass {
  if (status === "completed") return "good";
  if (status === "refunded") return "off";
  return "warn";
}

/** paid = good, unpaid = bad, pending = amber, unknown/none = muted. */
export function paymentPill(payment: string | null): PillClass {
  switch (payment) {
    case "paid":
      return "good";
    case "unpaid":
      return "bad";
    case "pending":
      return "warn";
    default:
      return "off";
  }
}

/** Shopee order lifecycle: done/shipped = good, to-ship = amber, cancelled = bad. */
export function orderStatusPill(status: string | null): PillClass {
  switch (status) {
    case "completed":
    case "shipped":
      return "good";
    case "to_ship":
      return "warn";
    case "cancelled":
      return "bad";
    default:
      return "off";
  }
}

/** The car model without its trailing model year — "Toyota Vios 2014" → "Toyota Vios". */
export function stripCarYear(vehicle?: string | null): string {
  return (vehicle ?? "").replace(/\s+(?:19|20)\d{2}$/, "").trim();
}

/** The trailing model year on its own — "Toyota Vios 2014" → "2014"; empty when there is none. */
export function carYearOf(vehicle?: string | null): string {
  const m = /\s+((?:19|20)\d{2})$/.exec(vehicle ?? "");
  return m ? m[1] : "";
}

/** "Toyota Vios 2014 · 1กก 1234" — drops whichever part is missing; empty when neither is set. */
export function vehicleLabel(vehicle?: string | null, plate?: string | null): string {
  const v = vehicle?.trim();
  const p = plate?.trim();
  if (v && p) return `${v} · ${p}`;
  return v || p || "";
}

/** A parts/repair chip for on-site sales; null when the sale type is unknown. */
export function saleTypeBadge(type: string | null): { pill: PillClass; label: string } | null {
  if (type === "repair") return { pill: "soft", label: "🔧 Service" };
  if (type === "parts") return { pill: "off", label: "📦 Products" };
  return null;
}

/**
 * Map a (verbose, Thai) Shopee order status to a short label + themed colour:
 * Complete=green · Shipped=blue · Shipping=yellow · Cancelled=gray · Refund=red.
 * Order matters — "buyer received" text also mentions refund eligibility, so it's checked first.
 */
export function shopeeStatusBadge(raw: string | null): { pill: PillClass; label: string } {
  const s = raw ?? "";
  // "buyer received" text contains refund-eligibility wording, and "refund success" contains
  // "สำเร็จ" — so check those before the plain สำเร็จ / status keywords.
  if (s.includes("ผู้ซื้อได้รับสินค้า")) return { pill: "info", label: "Shipped" };
  if (s.includes("คืนเงิน") || s.includes("คืนสินค้า")) return { pill: "bad", label: "Refund" };
  if (s.includes("ยกเลิก")) return { pill: "off", label: "Cancelled" };
  if (s.includes("สำเร็จ")) return { pill: "good", label: "Complete" };
  if (s.includes("จัดส่ง") || s.includes("รอ")) return { pill: "warn", label: "Shipping" };
  return { pill: "off", label: s || "—" };
}

/**
 * Map an AirPlus order status to a short label + colour. NOTE the colours differ from Shopee:
 * Done=green · Shipping=yellow · Refund=gray · Cancelled=red.
 */
export function airplusStatusBadge(raw: string | null): { pill: PillClass; label: string } {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("cancel") || s.includes("ยกเลิก")) return { pill: "bad", label: "Cancelled" };
  if (s.includes("refund") || s.includes("คืน")) return { pill: "off", label: "Refund" };
  if (s.includes("shipping") || s.includes("จัดส่ง")) return { pill: "warn", label: "Shipping" };
  if (s.includes("done") || s.includes("arrived") || s.includes("สำเร็จ"))
    return { pill: "good", label: "Done" };
  return { pill: "off", label: s || "—" };
}

/**
 * The /orders Status column: the owner's seven operational states, not the raw order_status column.
 * `operationalStatus` in core does the deriving (it needs BOTH axes — new+pending and new+cod are
 * different situations with the same order_status); this only picks the colour.
 */
export function operationalStatusBadge(
  orderStatus: string | null,
  paymentStatus: string | null,
): { pill: PillClass; label: string } {
  const s = operationalStatus(orderStatus, paymentStatus);
  // Colour is gray by default, on purpose (owner, 30 Jul 2026). Only three states earn a colour, and
  // each one is a state that needs the owner to DO something: approve a COD, pack a parcel, handle a
  // return. Colouring the rest — unpaid, in transit, complete, fail — would spend attention on
  // states where nothing is waiting on them, and a column where everything is coloured highlights
  // nothing. Keep this list short; add a colour only when a new state demands action.
  if (s == null) {
    // Unknown or pre-0069 Thai data: show the raw value rather than guess at one of the seven.
    return { pill: "off", label: orderStatus || "—" };
  }
  // Exactly the three the owner named, and no more. `verifying` and `claim_pending` are also
  // waiting-on-us states and arguably deserve a colour by the same logic, but the owner specified
  // three, so extending the palette is their call to make, not one to assume.
  const COLOURED: Partial<Record<typeof s, PillClass>> = {
    cod_pending: "warn", // yellow — waiting on the owner's COD decision
    to_ship: "info", // blue — waiting to be packed and sent
    return: "bad", // red — ตีกลับ, the parcel came back and needs handling
  };
  return { pill: COLOURED[s] ?? "off", label: operationalStatusLabel(s) };
}

/** Map an English order_status constant to a pill class. */
export function orderStatusBadge(status: string | null): { pill: PillClass; label: string } {
  switch (status) {
    case "new":
      return { pill: "warn", label: "New" };
    case "confirmed":
      return { pill: "good", label: "Confirmed" };
    case "packing":
      return { pill: "good", label: "Packing" };
    case "shipped":
      return { pill: "info", label: "Shipped" };
    case "delivered":
      return { pill: "good", label: "Delivered" };
    case "cancelled":
      return { pill: "bad", label: "Cancelled" };
    case "expired":
      return { pill: "bad", label: "Expired" };
    default:
      return { pill: "off", label: status || "—" };
  }
}

/** Map an English payment_status constant to a pill class. */
export function paymentStatusBadge(status: string | null): { pill: PillClass; label: string } {
  switch (status) {
    case "pending":
      return { pill: "off", label: "Pending" };
    case "paid":
      return { pill: "good", label: "Paid" };
    case "cod":
      return { pill: "soft", label: "COD" };
    case "cod_confirmed":
      return { pill: "good", label: "COD Approved" };
    case "cod_collected":
      return { pill: "good", label: "COD Collected" };
    case "cod_denied":
      return { pill: "bad", label: "COD Denied" };
    case "expired":
      return { pill: "bad", label: "Expired" };
    case "refunded":
      return { pill: "off", label: "Refunded" };
    default:
      return { pill: "off", label: status || "—" };
  }
}
