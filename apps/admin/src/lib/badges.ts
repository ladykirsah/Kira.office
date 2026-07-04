// Maps sale/order/payment statuses to the themed `.pill` variants in globals.css, plus a couple
// of label helpers. Pure + unit-tested so the tables can render consistent, dark-mode-aware badges.

export type PillClass = "good" | "warn" | "bad" | "off" | "soft";

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
